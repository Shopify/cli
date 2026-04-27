#!/usr/bin/env node
/**
 * Updates Observe resources (SLOs, alert rules, error projects) that pin the
 * latest CLI version. Replaces the manual post-release steps in the release
 * runbook (https://github.com/Shopify/develop-app-inner-loop/issues/2694) that
 * require clicking through observe.shopify.io to update version filters by hand.
 *
 * Usage:
 *   pnpm update-observe -- --version=3.94.2                          # update all resources
 *   pnpm update-observe -- --version=3.94.2 --resource=slo-p50-latency  # update one resource
 *   pnpm update-observe -- --version=3.94.2 --dry-run                # print payloads without sending
 *
 * --version is required and must be semver X.Y.Z.
 * --resource selects a single resource by its `key` from
 *   bin/observe-cli-resources.json (e.g. slo-correctness-app-deploy,
 *   slo-correctness, slo-p50-latency, slo-p75-latency, alert-spike-errors,
 *   error-project-cli). Omit to update all of them.
 *
 * Auth: requires a Shopify Monitoring API token in $SHOPIFY_MONITORING_TOKEN.
 * Get one at https://observe.shopify.io/profile (under "API Tokens") or via
 * `dev observe-token` if that command is available.
 *
 * Templates live in bin/observe-cli-resources.json. To add or remove a managed
 * resource, edit that file — no script changes required.
 */
import {readFileSync} from 'node:fs'
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
if (!version) {
  fail('--version is required (e.g. --version=3.94.2)')
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`Version must be semver X.Y.Z (got: ${version})`)
}

const config = JSON.parse(readFileSync(join(__dirname, 'observe-cli-resources.json'), 'utf-8'))

const allResources = [
  ...config.slos.map((slo) => ({type: 'slo', value: slo})),
  ...config.alertRules.map((rule) => ({type: 'alert', value: rule})),
  ...config.errorProjects.map((project) => ({type: 'errorProject', value: project})),
]

let selectedResources = allResources
if (args.resource) {
  selectedResources = allResources.filter((r) => r.value.key === args.resource)
  if (selectedResources.length === 0) {
    const keys = allResources.map((r) => r.value.key).join(', ')
    fail(`No resource with key "${args.resource}". Valid keys: ${keys}`)
  }
}
const TOKEN = process.env.SHOPIFY_MONITORING_TOKEN
if (!dryRun && !TOKEN) {
  fail('SHOPIFY_MONITORING_TOKEN is not set. See header of bin/update-observe.js for how to obtain one.')
}

const interpolate = (value) => {
  if (typeof value === 'string') return value.replaceAll('${version}', version)
  if (Array.isArray(value)) return value.map(interpolate)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v)]))
  }
  return value
}

const SLO_MUTATION = `
  mutation Upsert($input: UpsertSLODefinitionInput!) {
    upsertSLODefinition(input: $input) {
      sloDefinition { id name }
      error
    }
  }
`

const RULE_MUTATION = `
  mutation Upsert($input: UpsertRuleConfigsInput!) {
    upsertRuleConfigs(input: $input) {
      validationErrors { field message }
    }
  }
`

const ERROR_PROJECT_MUTATION = `
  mutation Upsert($input: ErrorProjectInput!) {
    upsertErrorProject(input: $input) {
      validationErrors { field message }
    }
  }
`

const main = async () => {
  const scope = args.resource ? `resource=${args.resource}` : `${selectedResources.length} resources`
  console.log(`Updating Observe ${scope} for ${config.service} → cli_version=${version}${dryRun ? ' (dry run)' : ''}`)

  const handlers = {slo: updateSlo, alert: updateAlertRule, errorProject: updateErrorProject}
  const results = await Promise.all(selectedResources.map(({type, value}) => handlers[type](value)))
  const failed = results.filter((ok) => !ok).length
  if (failed > 0) {
    fail(`${failed} of ${results.length} updates failed.`)
  }
  console.log(`✓ ${results.length} resource${results.length === 1 ? '' : 's'} updated.`)
}

const updateSlo = async (slo) => {
  const base = {id: slo.id, name: interpolate(slo.name)}
  const sloSpec =
    slo.kind === 'raw'
      ? {...base, rawSLIInput: {expression: interpolate(slo.expression), weightExpression: 'vector(1)'}}
      : {
          ...base,
          histogramSLIInput: {
            metric: {
              metricName: slo.metricName,
              metricType: slo.metricType,
              filters: interpolate(slo.filters),
            },
            minThreshold: slo.minThreshold,
            maxThreshold: slo.maxThreshold,
          },
        }
  return runMutation('SLO', slo.id, SLO_MUTATION, {input: {slo: sloSpec}}, (data) => data.upsertSLODefinition?.error)
}

const updateAlertRule = async (rule) => {
  const ruleConfigInput = {
    id: rule.id,
    name: interpolate(rule.name),
    vaultTeamId: config.vaultTeamId,
    customErrorFilters: JSON.stringify(interpolate(rule.customErrorFilters)),
  }
  return runMutation(
    'AlertRule',
    rule.id,
    RULE_MUTATION,
    {input: {ruleConfigInputs: [ruleConfigInput]}},
    (data) => data.upsertRuleConfigs?.validationErrors?.length ? JSON.stringify(data.upsertRuleConfigs.validationErrors) : null,
  )
}

const updateErrorProject = async (project) => {
  const errorProjectInput = {
    id: project.id,
    name: config.service,
    errorFilters: JSON.stringify(interpolate(project.errorFilters)),
  }
  return runMutation(
    'ErrorProject',
    project.id,
    ERROR_PROJECT_MUTATION,
    {input: errorProjectInput},
    (data) => data.upsertErrorProject?.validationErrors?.length ? JSON.stringify(data.upsertErrorProject.validationErrors) : null,
  )
}

const runMutation = async (kind, id, query, variables, getError) => {
  if (dryRun) {
    console.log(`-- ${kind} ${id} --`)
    console.log(JSON.stringify(variables, null, 2))
    return true
  }
  try {
    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`},
      body: JSON.stringify({query, variables}),
    })
    const json = await res.json()
    const err = json.errors ? JSON.stringify(json.errors) : getError(json.data ?? {})
    if (err) {
      console.error(`✖ ${kind} ${id}: ${err}`)
      return false
    }
    console.log(`✓ ${kind} ${id}`)
    return true
  } catch (error) {
    console.error(`✖ ${kind} ${id}: ${error.message}`)
    return false
  }
}

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

await main()
