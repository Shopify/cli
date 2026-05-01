#!/usr/bin/env node
/**
 * Updates Observe resources (SLOs, alert rules, error projects) that pin the
 * latest CLI version. Replaces the manual post-release steps in the release
 * runbook (https://github.com/Shopify/develop-app-inner-loop/issues/2694) that
 * require clicking through observe.shopify.io to update version filters by hand.
 *
 * For each resource the script:
 *   1. Fetches the live config from the Monitoring API.
 *   2. Patches only the version-touching fields by rewriting any X.Y.Z literal
 *      it finds in the live name, raw SLI expression, and version filter
 *      values. The JSON config holds no templates — the live values from
 *      Observe are the source of truth, so manual edits to surrounding text
 *      are preserved.
 *   3. Re-upserts the full resource so non-version fields (objective, alertType,
 *      notificationPolicyId, vaultTeamId, etc.) are preserved verbatim.
 *
 * Usage:
 *   pnpm update-observe -- --version=3.94.2                              # update all resources
 *   pnpm update-observe -- --version=3.94.2 --resource=slo-p50-latency   # update one resource
 *   pnpm update-observe -- --version=3.94.2 --dry-run                    # print payloads without sending
 *
 * --version is required and must be concrete semver X.Y.Z. Wildcards
 * (`*`) are intentionally not allowed in the CLI argument — if a live
 * resource in Observe pins a partial version like `3.*.*` or `4.90.*`, the
 * script preserves those wildcard components and only rewrites the numeric
 * ones. So given `--version=4.95.3`, a live `3.*.*` becomes `4.*.*` and a
 * live `4.90.*` becomes `4.95.*`.
 * --resource selects a single resource by its `key` from
 *   bin/observe-cli-resources.json. Omit to update all of them.
 *
 * Auth: the first run opens https://shopify-monitoring.shopifycloud.com/gql in
 * your browser, you sign in via Okta, copy the MINERVA_TOKEN cookie value from
 * DevTools, and paste it here. The script caches it at
 * ~/.cache/shopify-cli/observe-cookie (0600). Subsequent runs reuse the cache.
 * If the cookie has expired the script auto-detects the SSO redirect and
 * re-prompts.
 *
 * For non-interactive use (CI, scripts), set $MINERVA_TOKEN to skip the prompt.
 *
 * Templates live in bin/observe-cli-resources.json. To add or remove a managed
 * resource, edit that file — no script changes required.
 */
import {spawn} from 'node:child_process'
import {chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync} from 'node:fs'
import {homedir, platform} from 'node:os'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'

const __dirname = dirname(fileURLToPath(import.meta.url))

const {values: args} = parseArgs({
  options: {
    version: {type: 'string'},
    resource: {type: 'string'},
    'dry-run': {type: 'boolean', default: false},
  },
  strict: true,
})

const dryRun = args['dry-run']
const version = args.version
if (!version) fail('--version is required (e.g. --version=3.94.2)')
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`Version must be concrete semver X.Y.Z (got: ${version})`)

// Matches a 3-component version literal: digits or `*` separated by dots.
// Used to find/rewrite versions inside live names, expressions, and filter values.
const VERSION_LITERAL_RE = /(?<![\w.])(\d+|\*)\.(\d+|\*)\.(\d+|\*)(?![\w.])/g

const targetParts = version.split('.')

// Apply the target version to an existing version literal, component by
// component. Wildcard components in the LIVE value are preserved — only
// numeric components are rewritten. So if Observe pins `3.*.*` and we run
// with --version=4.95.3, we produce `4.*.*` (the wildcards stay).
const applyVersion = (existing) => {
  const eParts = existing.split('.')
  if (eParts.length !== 3) return version // unexpected shape; fall back to the literal target
  return eParts.map((e, i) => (e === '*' ? '*' : targetParts[i])).join('.')
}

// Rewrite every version literal found inside an arbitrary string.
const patchVersionString = (str) =>
  typeof str === 'string' ? str.replace(VERSION_LITERAL_RE, (match) => applyVersion(match)) : str

const config = JSON.parse(readFileSync(join(__dirname, 'observe-cli-resources.json'), 'utf-8'))
let COOKIE = null  // populated lazily; see authenticate()

let selected = config.resources
if (args.resource) {
  selected = config.resources.filter((r) => r.key === args.resource)
  if (selected.length === 0) {
    fail(`No resource with key "${args.resource}". Valid keys: ${config.resources.map((r) => r.key).join(', ')}`)
  }
}

// -- Resource handlers ------------------------------------------------------

const SLO_QUERY = `
  query($id: ID!) {
    sloDefinition(id: $id) {
      id name objective summary message description alertType
      useRecordingRules v2Enabled v2Summary v2Message escalatorEnabled
      threshold { critical warning for aggregation lookback }
      urls { href displayText }
      labels { name value }
      service { name }
      vaultTeam { id }
      notificationPolicy { id }
      sli {
        __typename
        ... on RawSLI { expression weightExpression }
        ... on HistogramSLI {
          metric { metricName metricType filters { key value op } }
          minThreshold maxThreshold
        }
      }
    }
  }
`

const SLO_MUTATION = `
  mutation Upsert($input: UpsertSLODefinitionInput!) {
    upsertSLODefinition(input: $input) { sloDefinition { id name } error }
  }
`

const RULE_QUERY = `
  query($id: ID!) {
    ruleConfig(id: $id) {
      id name expression for sustainType interval summary message
      dataSourceType disabled noData offsetOverrideSeconds
      v2Enabled v2Summary v2Message escalatorEnabled
      errorAlertFlavor customErrorFilters includedVersionCount
      threshold { critical warning operator type }
      urls { href displayText }
      labels { name value }
      vaultTeam { id }
      notificationPolicy { id }
      servicesDbService { name }
      errorAlertLabelFilters { label operator value }
    }
  }
`

const RULE_MUTATION = `
  mutation Upsert($input: UpsertRuleConfigsInput!) {
    upsertRuleConfigs(input: $input) { validationErrors { fieldErrors { path message } } }
  }
`

const ERROR_PROJECT_QUERY = `
  query($id: String!) {
    errorProject(id: $id) {
      id name zone serviceName platformType priorityCountType
      errorFilters includedVersionCount useLlm enableSegfaultIssues
      vaultTeam { id }
      severityThresholds { severity { id } value }
    }
  }
`

const ERROR_PROJECT_MUTATION = `
  mutation Upsert($input: ErrorProjectInput!) {
    upsertErrorProject(input: $input) { validationErrors { fieldErrors { path message } } }
  }
`

const stripUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null))

const buildSloInput = (live, resource) => {
  if (!live.sli || (live.sli.__typename !== 'RawSLI' && live.sli.__typename !== 'HistogramSLI')) {
    throw new Error(`Unsupported SLI type: ${live.sli?.__typename}`)
  }

  const input = stripUndefined({
    id: live.id,
    name: patchVersionString(live.name),
    objective: live.objective,
    vaultTeamId: live.vaultTeam?.id,
    serviceId: live.service?.name,
    summary: live.summary || undefined,
    message: live.message || undefined,
    description: live.description || undefined,
    alertType: live.alertType,
    useRecordingRules: live.useRecordingRules,
    v2Enabled: live.v2Enabled,
    v2Summary: live.v2Summary || undefined,
    v2Message: live.v2Message || undefined,
    escalatorEnabled: live.escalatorEnabled,
    notificationPolicyId: live.notificationPolicy?.id,
    threshold: live.threshold
      ? stripUndefined({
          critical: live.threshold.critical,
          warning: live.threshold.warning,
          for: live.threshold.for,
          aggregation: live.threshold.aggregation,
          lookback: live.threshold.lookback,
        })
      : undefined,
    urls: live.urls?.map((u) => ({href: u.href, displayText: u.displayText})),
    labels: live.labels?.map((l) => ({name: l.name, value: l.value})),
  })

  if (live.sli.__typename === 'RawSLI') {
    if (!live.sli.expression) {
      throw new Error(`Resource ${resource.key} is a RawSLI but has no live expression to patch`)
    }
    input.rawSLIInput = {
      expression: patchVersionString(live.sli.expression),
      weightExpression: patchVersionString(live.sli.weightExpression) || undefined,
    }
  } else {
    const filters = live.sli.metric.filters.map((f) => ({
      key: f.key,
      op: f.op,
      value: f.key === 'cli_version' && f.op === '=' ? applyVersion(f.value) : f.value,
    }))
    input.histogramSLIInput = {
      metric: {
        metricName: live.sli.metric.metricName,
        metricType: live.sli.metric.metricType,
        filters,
      },
      minThreshold: live.sli.minThreshold,
      maxThreshold: live.sli.maxThreshold,
    }
  }

  return input
}

const patchVersionInFilterJson = (jsonString, column) => {
  const parsed = JSON.parse(jsonString)
  const patchGroup = (group) => {
    if (group.filters) {
      for (const f of group.filters) {
        if (f.column === column && typeof f.value === 'string') f.value = applyVersion(f.value)
      }
    }
    if (group.filter_groups) group.filter_groups.forEach(patchGroup)
  }
  patchGroup(parsed)
  return JSON.stringify(parsed)
}

const buildRuleInput = (live, resource) => {
  if (!live.customErrorFilters) {
    throw new Error(`Alert rule ${resource.key} has no customErrorFilters to patch`)
  }
  return stripUndefined({
    id: live.id,
    name: patchVersionString(live.name),
    vaultTeamId: live.vaultTeam?.id,
    expression: patchVersionString(live.expression),
    dataSourceType: live.dataSourceType,
    for: live.for,
    sustainType: live.sustainType || undefined,
    interval: live.interval,
    summary: live.summary || undefined,
    message: live.message || undefined,
    disabled: live.disabled,
    noData: live.noData,
    offsetOverrideSeconds: live.offsetOverrideSeconds,
    v2Enabled: live.v2Enabled,
    v2Summary: live.v2Summary || undefined,
    v2Message: live.v2Message || undefined,
    escalatorEnabled: live.escalatorEnabled,
    notificationPolicyId: live.notificationPolicy?.id,
    servicesDbServiceName: live.servicesDbService?.name,
    errorAlertFlavor: live.errorAlertFlavor,
    customErrorFilters: patchVersionInFilterJson(live.customErrorFilters, resource.versionFilterColumn),
    includedVersionCount: live.includedVersionCount,
    threshold: live.threshold
      ? stripUndefined({
          critical: live.threshold.critical,
          warning: live.threshold.warning,
          operator: live.threshold.operator,
        })
      : undefined,
    urls: live.urls?.map((u) => ({href: u.href, displayText: u.displayText})),
    labels: live.labels?.map((l) => ({name: l.name, value: l.value})),
    errorAlertLabelFilters: live.errorAlertLabelFilters?.map((f) => ({
      label: f.label,
      operator: f.operator,
      value: f.value,
    })),
  })
}

const buildErrorProjectInput = (live, resource) => {
  if (!live.errorFilters) {
    throw new Error(`Error project ${resource.key} has no errorFilters to patch`)
  }
  return stripUndefined({
    id: live.id,
    name: patchVersionString(live.name),
    zone: live.zone || undefined,
    serviceName: live.serviceName || undefined,
    vaultTeamID: live.vaultTeam?.id,
    platformType: live.platformType || undefined,
    priorityCountType: live.priorityCountType,
    errorFilters: patchVersionInFilterJson(live.errorFilters, resource.versionFilterColumn),
    severityThresholds: live.severityThresholds?.map((t) => ({severityId: t.severity.id, value: t.value})),
    includedVersionCount: live.includedVersionCount,
    useLlm: live.useLlm,
    enableSegfaultIssues: live.enableSegfaultIssues,
  })
}

const HANDLERS = {
  slo: {
    query: SLO_QUERY,
    pickLive: (data) => data.sloDefinition,
    buildInput: buildSloInput,
    mutation: SLO_MUTATION,
    wrapInput: (input) => ({slo: input}),
    extractError: (data) => data.upsertSLODefinition?.error,
    label: 'SLO',
  },
  alert: {
    query: RULE_QUERY,
    pickLive: (data) => data.ruleConfig,
    buildInput: buildRuleInput,
    mutation: RULE_MUTATION,
    wrapInput: (input) => ({ruleConfigInputs: [input]}),
    extractError: (data) => {
      const errs = data.upsertRuleConfigs?.validationErrors ?? []
      return errs.length ? JSON.stringify(errs) : null
    },
    label: 'AlertRule',
  },
  errorProject: {
    query: ERROR_PROJECT_QUERY,
    pickLive: (data) => data.errorProject,
    buildInput: buildErrorProjectInput,
    mutation: ERROR_PROJECT_MUTATION,
    wrapInput: (input) => input,
    extractError: (data) => {
      const errs = data.upsertErrorProject?.validationErrors ?? []
      return errs.length ? JSON.stringify(errs) : null
    },
    label: 'ErrorProject',
  },
}

// -- HTTP -------------------------------------------------------------------

class AuthError extends Error {}

const graphql = async (query, variables) => {
  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Cookie: COOKIE},
    body: JSON.stringify({query, variables}),
  })
  const text = await res.text()
  if (text.trimStart().startsWith('<')) {
    throw new AuthError('SSO redirect — cookie missing or expired')
  }
  const json = JSON.parse(text)
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

// -- Cookie management ------------------------------------------------------

const MONITORING_GQL_URL = 'https://shopify-monitoring.shopifycloud.com/gql'

function cookieCachePath() {
  const cacheRoot =
    platform() === 'darwin'
      ? join(homedir(), 'Library', 'Caches')
      : platform() === 'win32'
        ? process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
        : process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache')
  return join(cacheRoot, 'shopify-cli', 'observe-cookie')
}

function readCachedCookie() {
  const path = cookieCachePath()
  if (!existsSync(path)) return null
  const value = readFileSync(path, 'utf-8').trim()
  return value || null
}

function writeCachedCookie(cookie) {
  const path = cookieCachePath()
  mkdirSync(dirname(path), {recursive: true})
  writeFileSync(path, cookie)
  try {
    chmodSync(path, 0o600)
  } catch {
    // chmod is best-effort; on Windows it's a no-op
  }
}

function clearCachedCookie() {
  const path = cookieCachePath()
  if (existsSync(path)) unlinkSync(path)
}

function normalizeCookie(input) {
  const trimmed = input.trim().replace(/^Cookie:\s*/i, '')
  return trimmed.includes('=') ? trimmed : `MINERVA_TOKEN=${trimmed}`
}

function openInBrowser(url) {
  const [cmd, ...args] =
    platform() === 'darwin' ? ['open', url]
      : platform() === 'win32' ? ['cmd', '/c', 'start', '', url]
      : ['xdg-open', url]
  try {
    spawn(cmd, args, {stdio: 'ignore', detached: true}).unref()
  } catch {
    // best-effort; user can open manually
  }
}

function promptHidden(message) {
  return new Promise((resolve, reject) => {
    process.stdout.write(message)
    const stdin = process.stdin
    if (!stdin.isTTY) {
      reject(new Error('Cannot prompt for cookie: stdin is not a TTY. Set $MINERVA_TOKEN instead.'))
      return
    }
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let buf = ''
    const onData = (ch) => {
      switch (ch) {
        case '\n': case '\r': case '\u0004':
          stdin.setRawMode(false)
          stdin.pause()
          stdin.removeListener('data', onData)
          process.stdout.write('\n')
          resolve(buf)
          break
        case '\u0003':
          process.stdout.write('\n')
          process.exit(130)
          break
        case '\u007f': case '\b':
          if (buf.length > 0) buf = buf.slice(0, -1)
          break
        default:
          buf += ch
      }
    }
    stdin.on('data', onData)
  })
}

async function promptForCookie() {
  if (!process.stdin.isTTY) {
    fail('No valid Observe session found and stdin is not a TTY. Set $MINERVA_TOKEN to skip the interactive prompt.')
  }
  console.log('\nNo valid Observe session found. Opening your browser to sign in...')
  console.log(`  ${MONITORING_GQL_URL}`)
  console.log('\nAfter the page loads (Okta SSO if needed):')
  console.log('  1. Open DevTools → Application → Cookies → shopify-monitoring.shopifycloud.com')
  console.log('  2. Find the MINERVA_TOKEN cookie and copy its value')
  console.log('  3. Paste it below (input is hidden)\n')
  openInBrowser(MONITORING_GQL_URL)
  const value = await promptHidden('MINERVA_TOKEN: ')
  if (!value.trim()) fail('Empty cookie value.')
  return normalizeCookie(value)
}

async function probeAuth() {
  await graphql('query { __typename }', {})
}

async function authenticate() {
  if (process.env.MINERVA_TOKEN) {
    COOKIE = normalizeCookie(process.env.MINERVA_TOKEN)
  } else {
    COOKIE = readCachedCookie()
  }
  if (COOKIE) {
    try {
      await probeAuth()
      return
    } catch (error) {
      if (!(error instanceof AuthError)) throw error
      if (process.env.MINERVA_TOKEN) {
        fail('$MINERVA_TOKEN is set but rejected by the API (cookie likely expired). Refresh it from your browser.')
      }
      console.log('Cached cookie is no longer valid — re-authenticating.')
      clearCachedCookie()
      COOKIE = null
    }
  }
  COOKIE = await promptForCookie()
  try {
    await probeAuth() // throws AuthError if the user pasted a bad value
  } catch (error) {
    if (error instanceof AuthError) {
      fail('The cookie value you pasted was rejected by the API. Double-check the MINERVA_TOKEN value and try again.')
    }
    throw error
  }
  // Only persist after we've confirmed the cookie actually works.
  writeCachedCookie(COOKIE)
  console.log(`Saved to ${cookieCachePath()} (mode 0600). It will be reused on future runs until it expires.\n`)
}

// -- Main loop --------------------------------------------------------------

const updateOne = async (resource) => {
  const handler = HANDLERS[resource.kind]
  if (!handler) {
    console.error(`✖ ${resource.key}: unknown kind "${resource.kind}"`)
    return false
  }
  try {
    const live = handler.pickLive(await graphql(handler.query, {id: resource.id}))
    if (!live) throw new Error(`Resource ${resource.id} not found via API`)

    const input = handler.buildInput(live, resource)
    const variables = {input: handler.wrapInput(input)}

    if (dryRun) {
      console.log(`-- ${handler.label} ${resource.key} --`)
      console.log(JSON.stringify(variables, null, 2))
      return true
    }

    const data = await graphql(handler.mutation, variables)
    const err = handler.extractError(data)
    if (err) {
      console.error(`✖ ${handler.label} ${resource.key}: ${err}`)
      return false
    }
    console.log(`✓ ${handler.label} ${resource.key}`)
    return true
  } catch (error) {
    console.error(`✖ ${resource.key}: ${error.message}`)
    return false
  }
}

const main = async () => {
  await authenticate()

  const scope = args.resource ? `resource=${args.resource}` : `${selected.length} resources`
  console.log(`Updating Observe ${scope} for ${config.service} → cli_version=${version}${dryRun ? ' (dry run)' : ''}`)

  const results = await Promise.all(selected.map(updateOne))
  const failed = results.filter((ok) => !ok).length
  if (failed > 0) fail(`${failed} of ${results.length} updates failed.`)
  console.log(`✓ ${results.length} resource${results.length === 1 ? '' : 's'} updated.`)
}

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

try {
  await main()
} catch (error) {
  fail(error.message)
}
