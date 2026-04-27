#!/usr/bin/env node
/**
 * Updates Observe resources (SLOs, alert rules, error projects) that pin the
 * latest CLI version. Replaces the manual post-release steps in the release
 * runbook (https://github.com/Shopify/develop-app-inner-loop/issues/2694) that
 * require clicking through observe.shopify.io to update version filters by hand.
 *
 * For each resource the script:
 *   1. Fetches the live config from the Monitoring API.
 *   2. Patches only the version-touching fields (name, raw SLI expression,
 *      cli_version filter, app.version filter).
 *   3. Re-upserts the full resource so non-version fields (objective, alertType,
 *      notificationPolicyId, vaultTeamId, etc.) are preserved verbatim.
 *
 * Usage:
 *   pnpm update-observe -- --version=3.94.2                              # update all resources
 *   pnpm update-observe -- --version=3.94.2 --resource=slo-p50-latency   # update one resource
 *   pnpm update-observe -- --version=3.94.2 --dry-run                    # print payloads without sending
 *
 * --version is required and must be semver X.Y.Z.
 * --resource selects a single resource by its `key` from
 *   bin/observe-cli-resources.json. Omit to update all of them.
 *
 * Auth: reuses the cookie cache from the Shopify `observe` Rust CLI
 * (https://github.com/Shopify/world/tree/main/areas/tools/observe-cli). One-time
 * setup:
 *
 *   observe auth        # opens browser, signs in via Okta, caches cookies to disk
 *
 * After that this script just reads the cached cookie file. If the cookie has
 * expired, re-run `observe auth`.
 *
 * Templates live in bin/observe-cli-resources.json. To add or remove a managed
 * resource, edit that file — no script changes required.
 */
import {existsSync, readFileSync} from 'node:fs'
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
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`Version must be semver X.Y.Z (got: ${version})`)

const config = JSON.parse(readFileSync(join(__dirname, 'observe-cli-resources.json'), 'utf-8'))
const COOKIE = dryRun ? loadCookieOrNull() : loadCookie()

let selected = config.resources
if (args.resource) {
  selected = config.resources.filter((r) => r.key === args.resource)
  if (selected.length === 0) {
    fail(`No resource with key "${args.resource}". Valid keys: ${config.resources.map((r) => r.key).join(', ')}`)
  }
}

const interpolate = (template) => template.replaceAll('${version}', version)

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
    name: interpolate(resource.nameTemplate),
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
    if (!resource.rawExpressionTemplate) {
      throw new Error(`Resource ${resource.key} is a RawSLI but has no rawExpressionTemplate`)
    }
    input.rawSLIInput = {
      expression: interpolate(resource.rawExpressionTemplate),
      weightExpression: live.sli.weightExpression || undefined,
    }
  } else {
    const filters = live.sli.metric.filters.map((f) => ({
      key: f.key,
      op: f.op,
      value: f.key === 'cli_version' && f.op === '=' ? version : f.value,
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
        if (f.column === column) f.value = version
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
    name: interpolate(resource.nameTemplate),
    vaultTeamId: live.vaultTeam?.id,
    expression: live.expression,
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
    name: live.name,
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

const graphql = async (query, variables) => {
  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Cookie: COOKIE},
    body: JSON.stringify({query, variables}),
  })
  const text = await res.text()
  if (text.trimStart().startsWith('<')) {
    throw new Error('Auth failed (received HTML, likely an SSO redirect). Run `observe auth` to refresh cookies.')
  }
  const json = JSON.parse(text)
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

// -- Cookie cache (shared with the Rust `observe` CLI) ---------------------

function observeConfigDir() {
  if (platform() === 'darwin') return join(homedir(), 'Library', 'Application Support', 'observe')
  if (platform() === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'observe')
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'observe')
}

function loadCookieOrNull() {
  const dir = observeConfigDir()
  for (const name of ['graphql_cookies.txt', 'cookies.txt']) {
    const path = join(dir, name)
    if (existsSync(path)) {
      const value = readFileSync(path, 'utf-8').trim()
      if (value) return value
    }
  }
  return null
}

function loadCookie() {
  const cookie = loadCookieOrNull()
  if (!cookie) {
    fail(
      `No GraphQL cookies found in ${observeConfigDir()}.\n` +
        'Run `observe auth` first to sign in via Okta and cache cookies (see https://github.com/Shopify/world/tree/main/areas/tools/observe-cli).',
    )
  }
  return cookie
}

// -- Main loop --------------------------------------------------------------

const updateOne = async (resource) => {
  const handler = HANDLERS[resource.kind]
  if (!handler) {
    console.error(`✖ ${resource.key}: unknown kind "${resource.kind}"`)
    return false
  }
  try {
    // In dry-run we still query (when authed) so the printed payload reflects real merging.
    let live
    if (dryRun && !COOKIE) {
      console.log(`-- ${handler.label} ${resource.key} (dry-run, no observe cookie) --`)
      console.log('Note: run `observe auth` to see the merged payload.')
      return true
    }
    live = handler.pickLive(await graphql(handler.query, {id: resource.id}))
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

await main()
