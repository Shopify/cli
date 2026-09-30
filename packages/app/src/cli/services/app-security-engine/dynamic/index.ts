import {RULE_CATALOG} from '../rules/catalog.js'
import {redactIssue} from '../trace/index.js'
import {RUNTIME_REQUEST_CHECK_IDS} from '../types.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {relativePath} from '@shopify/cli-kit/node/path'
import type {AppSecurityRequest, AppSecurityRequestManifest} from './requests.js'
import type {ScanContext} from '../rules/types.js'
import type {
  CheckExecution,
  CheckExecutionReason,
  Issue,
  RequestAuthenticationMethod,
  RuntimeProbeRequest,
  RuntimeProbeResult,
  RuntimeProbeStatus,
  RuntimeRequestResult,
} from '../types.js'

export interface DynamicCheckDefinition {
  id: string
  version: number
}

export const DYNAMIC_CHECKS: ReadonlyArray<DynamicCheckDefinition> = [
  {id: RUNTIME_REQUEST_CHECK_IDS[0], version: 1},
  {id: RUNTIME_REQUEST_CHECK_IDS[1], version: 1},
  {id: RUNTIME_REQUEST_CHECK_IDS[2], version: 1},
  {id: RUNTIME_REQUEST_CHECK_IDS[3], version: 1},
  {id: RUNTIME_REQUEST_CHECK_IDS[4], version: 2},
]

interface Probe {
  id: string
  name: string
  authentication: RequestAuthenticationMethod
  endpointPath: string
  url: URL
  options: Parameters<typeof fetch>[1]
}

interface ProbeResponse {
  probe: Probe
  status?: number
}

interface ProbePlan {
  probes: Probe[]
  omittedTargets: number
}

export interface DynamicProbeResult {
  issues: Issue[]
  checksExecuted: CheckExecution[]
  requestResults: RuntimeRequestResult[]
}

const REQUEST_TIMEOUT_MILLISECONDS = 5_000
const PROBE_SHOP = 'app-security-probe.invalid.myshopify.com'
const INVALID_TOKEN = 'app-security.invalid.token'
const MAX_TARGETS_PER_CHECK = 10
const PACKAGE_DOCS_BASE_URL = 'https://github.com/shop/world/blob/main/areas/apps/shopify-app-packages/docs'
const AUTHENTICATION_GUIDES: Partial<Record<RequestAuthenticationMethod, string>> = {
  app_home: `${PACKAGE_DOCS_BASE_URL}/verifyAppHomeReq.md`,
  admin_ui_extension: `${PACKAGE_DOCS_BASE_URL}/verifyAdminUIExtReq.md`,
  checkout_ui_extension: `${PACKAGE_DOCS_BASE_URL}/verifyCheckoutUIExtReq.md`,
  customer_account_ui_extension: `${PACKAGE_DOCS_BASE_URL}/verifyCustomerAccountUIExtReq.md`,
  pos_ui_extension: `${PACKAGE_DOCS_BASE_URL}/verifyPosUIExtReq.md`,
  sidekick_extension: `${PACKAGE_DOCS_BASE_URL}/verifyAdminUIExtReq.md`,
  webhook: `${PACKAGE_DOCS_BASE_URL}/verifyWebhookReq.md`,
  flow_action: `${PACKAGE_DOCS_BASE_URL}/verifyFlowActionReq.md`,
  app_proxy: `${PACKAGE_DOCS_BASE_URL}/verifyAppProxyReq.md`,
}
const UI_EXTENSION_METHODS: RequestAuthenticationMethod[] = [
  'admin_ui_extension',
  'checkout_ui_extension',
  'customer_account_ui_extension',
  'pos_ui_extension',
  'sidekick_extension',
]

export async function runRequestSecurityProbes(
  context: ScanContext,
  probeUrl: string,
  manifest: AppSecurityRequestManifest,
  request: typeof fetch = fetch,
): Promise<DynamicProbeResult> {
  const baseUrl = new URL(probeUrl)
  const configPath = context.appToml
    ? relativePath(context.appRoot, context.appToml.path).replace(/\\/g, '/')
    : undefined
  const results = await Promise.all(
    DYNAMIC_CHECKS.map(async (definition) => runCheck(definition, context, manifest, baseUrl, configPath, request)),
  )

  return {
    issues: results.flatMap((result) => result.issues),
    checksExecuted: results.map((result) => result.execution),
    requestResults: results.flatMap((result) => result.requestResults),
  }
}

async function runCheck(
  definition: DynamicCheckDefinition,
  context: ScanContext,
  manifest: AppSecurityRequestManifest,
  baseUrl: URL,
  configPath: string | undefined,
  request: typeof fetch,
): Promise<{issues: Issue[]; execution: CheckExecution; requestResults: RuntimeRequestResult[]}> {
  const plan = probesForCheck(definition.id, manifest, baseUrl)
  if (plan.probes.length === 0 || !configPath) {
    return {
      issues: [],
      execution: checkExecution(definition, context, 'not_applicable', [], 0, {
        code: 'no_relevant_files',
        message: noProbeReason(definition.id, configPath),
      }),
      requestResults: [],
    }
  }

  const responses = await Promise.all(plan.probes.map((probe) => executeProbe(probe, request)))
  const accepted = responses.filter((response) => response.status !== undefined && isSuccess(response.status))
  const failures = responses.filter((response) => response.status === undefined)
  const issues = accepted.length > 0 ? [probeIssue(definition, configPath, accepted)] : []
  const reason = probeCoverageReason(definition.id, failures.length, responses.length, plan.omittedTargets)

  return {
    issues,
    execution: checkExecution(
      definition,
      context,
      reason ? 'unresolved' : 'executed',
      [configPath],
      issues.length,
      reason,
    ),
    requestResults: runtimeRequestResults(definition, responses),
  }
}

function probesForCheck(id: string, manifest: AppSecurityRequestManifest, baseUrl: URL): ProbePlan {
  if (id === 'APP_HOME_INVALID_TOKEN_ACCEPTED') return tokenProbePlan(manifest, baseUrl, ['app_home'])
  if (id === 'UI_EXTENSION_INVALID_TOKEN_ACCEPTED') return tokenProbePlan(manifest, baseUrl, UI_EXTENSION_METHODS)
  if (id === 'FLOW_ACTION_UNVERIFIED_HMAC') return hmacProbePlan(manifest, baseUrl, 'flow_action', 'flow action')
  if (id === 'WEBHOOK_UNVERIFIED_HMAC') return hmacProbePlan(manifest, baseUrl, 'webhook', 'webhook')
  if (id === 'APP_PROXY_UNVERIFIED_SIGNATURE') return appProxyProbePlan(manifest, baseUrl)
  return {probes: [], omittedTargets: 0}
}

function tokenProbePlan(
  manifest: AppSecurityRequestManifest,
  baseUrl: URL,
  methods: RequestAuthenticationMethod[],
): ProbePlan {
  const {requests, omittedTargets} = boundedRequests(requestsForMethods(manifest, methods))
  return {
    probes: requests.map((entry) =>
      probe(entry, baseUrl, 'invalid_bearer_token', `${methodLabel(entry.method)} request with invalid bearer token`, {
        method: 'POST',
        headers: probeHeaders({Authorization: `Bearer ${INVALID_TOKEN}`, 'Content-Type': 'application/json'}),
        body: '{}',
      }),
    ),
    omittedTargets,
  }
}

function hmacProbePlan(
  manifest: AppSecurityRequestManifest,
  baseUrl: URL,
  method: RequestAuthenticationMethod,
  label: string,
): ProbePlan {
  const {requests, omittedTargets} = boundedRequests(requestsForMethods(manifest, [method]))
  const probes = requests.flatMap((entry): Probe[] => [
    probe(entry, baseUrl, 'non_post_method', `non-POST ${label} request`, {
      method: 'GET',
      headers: probeHeaders(),
    }),
    probe(entry, baseUrl, 'missing_hmac', `${label} without HMAC`, {
      method: 'POST',
      headers: probeHeaders({'Content-Type': 'application/json'}),
      body: '{}',
    }),
    probe(entry, baseUrl, 'invalid_hmac', `${label} with invalid HMAC`, {
      method: 'POST',
      headers: probeHeaders({
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': 'invalid-hmac',
        'X-Shopify-Shop-Domain': PROBE_SHOP,
        'X-Shopify-Topic': 'app_security/probe',
        'shopify-hmac-sha256': 'invalid-hmac',
        'shopify-shop-domain': PROBE_SHOP,
      }),
      body: '{}',
    }),
  ])
  return {probes, omittedTargets}
}

function appProxyProbePlan(manifest: AppSecurityRequestManifest, baseUrl: URL): ProbePlan {
  const {requests, omittedTargets} = boundedRequests(requestsForMethods(manifest, ['app_proxy']))
  const timestamp = Math.floor(Date.now() / 1_000)
  return {
    probes: requests.flatMap((entry): Probe[] => [
      proxyProbe(entry, baseUrl, 'missing_signature', 'app proxy without signature', {
        shop: PROBE_SHOP,
        timestamp: String(timestamp),
      }),
      proxyProbe(entry, baseUrl, 'invalid_signature', 'app proxy with invalid signature', {
        shop: PROBE_SHOP,
        timestamp: String(timestamp),
        signature: 'invalid-signature',
      }),
      proxyProbe(entry, baseUrl, 'missing_timestamp', 'app proxy without timestamp', {
        shop: PROBE_SHOP,
        signature: 'invalid-signature',
      }),
      proxyProbe(entry, baseUrl, 'stale_timestamp', 'app proxy with stale timestamp', {
        shop: PROBE_SHOP,
        timestamp: String(timestamp - 120),
        signature: 'invalid-signature',
      }),
      proxyProbe(
        entry,
        baseUrl,
        'duplicate_shop_parameters',
        'app proxy with duplicate shop parameters',
        {shop: PROBE_SHOP, timestamp: String(timestamp), signature: 'invalid-signature'},
        `&shop=${encodeURIComponent(`second-${PROBE_SHOP}`)}`,
      ),
    ]),
    omittedTargets,
  }
}

function probe(entry: AppSecurityRequest, baseUrl: URL, id: string, name: string, options: Probe['options']): Probe {
  return {
    id,
    name,
    authentication: entry.method,
    endpointPath: entry.url,
    url: new URL(entry.url, baseUrl.origin),
    options,
  }
}

function proxyProbe(
  entry: AppSecurityRequest,
  baseUrl: URL,
  id: string,
  name: string,
  parameters: Record<string, string>,
  suffix = '',
): Probe {
  const value = probe(entry, baseUrl, id, name, {method: 'GET', headers: probeHeaders()})
  for (const [key, parameter] of Object.entries(parameters)) value.url.searchParams.append(key, parameter)
  if (suffix) value.url.search += suffix
  return value
}

function requestsForMethods(
  manifest: AppSecurityRequestManifest,
  methods: RequestAuthenticationMethod[],
): AppSecurityRequest[] {
  const allowed = new Set<RequestAuthenticationMethod>(methods)
  return manifest.requests.filter((request) => allowed.has(request.method))
}

function boundedRequests(allRequests: AppSecurityRequest[]): {requests: AppSecurityRequest[]; omittedTargets: number} {
  const requests = allRequests.slice(0, MAX_TARGETS_PER_CHECK)
  return {requests, omittedTargets: allRequests.length - requests.length}
}

function methodLabel(method: RequestAuthenticationMethod): string {
  return method.replaceAll('_', ' ')
}

function probeHeaders(additional: Record<string, string> = {}): Record<string, string> {
  return {'User-Agent': 'Shopify-CLI-App-Security-Probe', ...additional}
}

async function executeProbe(value: Probe, request: typeof fetch): Promise<ProbeResponse> {
  return request(value.url.href, {
    ...value.options,
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
  }).then(
    (response) => ({probe: value, status: response.status}),
    () => ({probe: value}),
  )
}

function runtimeRequestResults(definition: DynamicCheckDefinition, responses: ProbeResponse[]): RuntimeRequestResult[] {
  const catalog = catalogEntry(definition.id)
  const byEndpoint = new Map<string, ProbeResponse[]>()
  for (const response of responses) {
    const key = `${response.probe.authentication}:${response.probe.endpointPath}`
    const endpointResponses = byEndpoint.get(key) ?? []
    endpointResponses.push(response)
    byEndpoint.set(key, endpointResponses)
  }

  return [...byEndpoint.values()].map((endpointResponses) => {
    const probeResults = endpointResponses.map(runtimeProbeResult)
    const status = aggregateProbeStatus(probeResults)
    const failed = probeResults.filter((probe) => probe.status === 'failed').length
    const unresolved = probeResults.filter((probe) => probe.status === 'unresolved').length
    const authentication = endpointResponses[0]!.probe.authentication
    const guide = AUTHENTICATION_GUIDES[authentication] ?? catalog.guide
    return {
      id: definition.id,
      version: definition.version,
      severity: catalog.severity,
      title: catalog.title,
      endpoint: {
        url: endpointResponses[0]!.probe.endpointPath,
        authentication,
      },
      status,
      description: runtimeResultDescription(probeResults.length, failed, unresolved),
      probes: probeResults,
      remediation: {description: catalog.fix, ...(guide ? {guide} : {})},
    }
  })
}

function runtimeProbeResult(response: ProbeResponse): RuntimeProbeResult {
  const status = runtimeProbeStatus(response.status)
  return {
    id: response.probe.id,
    status,
    request: probeRequest(response.probe),
    expected: {outcome: 'rejected'},
    ...(response.status === undefined ? {} : {response: {status: response.status}}),
    description: runtimeProbeDescription(status, response.status),
  }
}

function runtimeProbeStatus(responseStatus: number | undefined): RuntimeProbeStatus {
  if (responseStatus === undefined) return 'unresolved'
  return isSuccess(responseStatus) ? 'failed' : 'passed'
}

function runtimeProbeDescription(status: RuntimeProbeStatus, responseStatus: number | undefined): string {
  if (responseStatus === undefined) return 'No HTTP response was received.'
  if (status === 'failed')
    return `Expected the request to be rejected, but the endpoint returned HTTP ${responseStatus}.`
  return `The endpoint rejected the request with HTTP ${responseStatus}.`
}

function probeRequest(value: Probe): RuntimeProbeRequest {
  const headers = Object.fromEntries(
    Object.entries((value.options?.headers as Record<string, string> | undefined) ?? {})
      .filter(([name]) => name.toLowerCase() !== 'user-agent')
      .map(([name, headerValue]) => [name, safeHeaderValue(name, headerValue)]),
  )
  const query: Record<string, string | string[]> = {}
  for (const [name, queryValue] of value.url.searchParams) {
    const current = query[name]
    if (current === undefined) query[name] = queryValue
    else if (Array.isArray(current)) query[name] = [...current, queryValue]
    else query[name] = [current, queryValue]
  }
  return {
    method: String(value.options?.method ?? 'GET').toUpperCase(),
    path: value.endpointPath,
    ...(Object.keys(headers).length > 0 ? {headers} : {}),
    ...(Object.keys(query).length > 0 ? {query} : {}),
  }
}

function safeHeaderValue(name: string, value: string): string {
  const normalized = name.toLowerCase()
  if (normalized === 'authorization') return '<invalid-token>'
  if (normalized.includes('hmac')) return '<invalid-hmac>'
  return value
}

function aggregateProbeStatus(probes: RuntimeProbeResult[]): RuntimeProbeStatus {
  if (probes.some((probe) => probe.status === 'failed')) return 'failed'
  if (probes.some((probe) => probe.status === 'unresolved')) return 'unresolved'
  return 'passed'
}

function runtimeResultDescription(total: number, failed: number, unresolved: number): string {
  if (failed > 0) return `${failed} of ${total} rejection probes were accepted by the endpoint.`
  if (unresolved > 0) return `${unresolved} of ${total} rejection probes did not receive an HTTP response.`
  return `All ${total} rejection probes were rejected by the endpoint.`
}

function probeIssue(definition: DynamicCheckDefinition, configPath: string, responses: ProbeResponse[]): Issue {
  const catalog = catalogEntry(definition.id)
  const summaries = responses.map((response) => `${response.probe.name} returned HTTP ${response.status}`).join('; ')
  return redactIssue({
    id: definition.id,
    pattern_id: 'runtime-request-accepted',
    rule_version: definition.version,
    found_by: 'external',
    severity: catalog.severity,
    points: catalog.points,
    title: catalog.title,
    message: `The running app accepted request-security probes that should have been rejected: ${summaries}.`,
    location: {file: configPath},
    evidence: responses.map((response) => ({
      location: {file: configPath},
      quote: `${response.probe.endpointPath}: ${response.probe.name} returned HTTP ${response.status}`,
    })),
    fix: {automated: false, description: catalog.fix, guide: catalog.guide},
    confidence: 'definite',
  })
}

function catalogEntry(id: string) {
  const catalog = RULE_CATALOG.find((entry) => entry.id === id)
  if (!catalog) throw new Error(`Missing catalog entry for dynamic check: ${id}`)
  return catalog
}

function checkExecution(
  definition: DynamicCheckDefinition,
  context: ScanContext,
  status: CheckExecution['status'],
  inspectedFiles: string[],
  findings: number,
  reason?: CheckExecutionReason,
): CheckExecution {
  return {
    id: definition.id,
    version: definition.version,
    kind: 'external',
    status,
    required: status !== 'not_applicable',
    applicable: status !== 'not_applicable',
    languages: context.detection.languages.map((language) => language.name),
    framework: context.detection.framework,
    surface: context.detection.surface,
    inspected_files: inspectedFiles,
    findings,
    analysis_mode: 'external',
    ...(reason ? {reason} : {}),
    ...(status === 'unresolved'
      ? {guidance: 'Start the running app, verify the probe URL, and run the request manifest again.'}
      : {}),
  }
}

function probeCoverageReason(
  id: string,
  failedProbes: number,
  completedProbes: number,
  omittedTargets: number,
): CheckExecutionReason | undefined {
  if (failedProbes === 0 && omittedTargets === 0) return undefined
  const details = [
    ...(failedProbes > 0 ? [`${failedProbes} of ${completedProbes} requests failed`] : []),
    ...(omittedTargets > 0 ? [`${omittedTargets} endpoints exceeded the ${MAX_TARGETS_PER_CHECK}-target limit`] : []),
  ]
  return {
    code: omittedTargets > 0 ? 'probe_limit' : 'network_unavailable',
    message: `${id} request probes had incomplete coverage: ${details.join('; ')}.`,
  }
}

function noProbeReason(id: string, configPath: string | undefined): string {
  if (!configPath) return 'No readable Shopify app configuration was available for request-security probes.'
  return `${id} has no matching endpoint in the App Security request manifest.`
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300
}
