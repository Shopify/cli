import {runRequestSecurityProbes} from '../dynamic/index.js'
import {scanApp} from '../run.js'
import {hasRecordedAgentReview} from '../trace/index.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {createServer, type IncomingMessage, type Server} from 'node:http'
import type {AppSecurityRequestManifest} from '../dynamic/requests.js'
import type {ScanContext} from '../rules/types.js'

interface ReceivedRequest {
  method: string
  url: URL
  headers: IncomingMessage['headers']
  body: string
}

async function localServer(
  responseStatus: (request: ReceivedRequest) => number,
): Promise<{server: Server; url: string; requests: ReceivedRequest[]}> {
  const requests: ReceivedRequest[] = []
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const received = {
        method: request.method ?? '',
        url: new URL(request.url ?? '/', 'http://localhost'),
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }
      requests.push(received)
      response.writeHead(responseStatus(received))
      response.end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected local TCP server address')
  return {server, url: `http://127.0.0.1:${address.port}/app`, requests}
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    }),
  )
}

function context(): ScanContext {
  return {
    appRoot: '/app',
    appToml: {raw: {}, path: '/app/shopify.app.toml', redirectUrls: [], webhooks: []},
    appTomls: [],
    extensions: [],
    sourceFiles: [],
    manifests: [],
    dependencyAutomation: {files: []},
    sensitiveFiles: [],
    capabilities: {
      theme_app_extension: false,
      app_embed: false,
      embedded_app: false,
      script_tags: false,
      webhooks: false,
      app_proxy: false,
      storefront_metafield_writes: false,
      has_backend: true,
      declared_ip_allowlist: false,
      checkout_extension: false,
    },
    detection: {framework: 'react_router', surface: 'react_router', languages: []},
    sourceCandidates: [],
  }
}

function requestManifest(requests: AppSecurityRequestManifest['requests'] = defaultRequests()) {
  return {schema_version: 1 as const, requests}
}

function defaultRequests(): AppSecurityRequestManifest['requests'] {
  return [
    {url: '/app', method: 'app_home'},
    {url: '/admin-extension', method: 'admin_ui_extension'},
    {url: '/checkout-extension', method: 'checkout_ui_extension'},
    {url: '/customer-account-extension', method: 'customer_account_ui_extension'},
    {url: '/pos-extension', method: 'pos_ui_extension'},
    {url: '/sidekick', method: 'sidekick_extension'},
    {url: '/flow', method: 'flow_action'},
    {url: '/webhooks/secure', method: 'webhook'},
    {url: '/webhooks/open', method: 'webhook'},
    {url: '/proxy', method: 'app_proxy'},
  ]
}

describe('running-app request-security probes', () => {
  test('uses the agent manifest to probe every authentication method against the explicit host', async () => {
    const fixture = await localServer((request) => (request.url.pathname === '/webhooks/secure' ? 401 : 200))
    try {
      const result = await runRequestSecurityProbes(context(), fixture.url, requestManifest())

      expect(result.issues.map((issue) => issue.id).sort()).toEqual([
        'APP_HOME_INVALID_TOKEN_ACCEPTED',
        'APP_PROXY_UNVERIFIED_SIGNATURE',
        'FLOW_ACTION_UNVERIFIED_HMAC',
        'UI_EXTENSION_INVALID_TOKEN_ACCEPTED',
        'WEBHOOK_UNVERIFIED_HMAC',
      ])
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'WEBHOOK_UNVERIFIED_HMAC',
            message: expect.stringContaining('webhook with invalid HMAC returned HTTP 200'),
            location: {file: 'shopify.app.toml'},
          }),
          expect.objectContaining({
            id: 'UI_EXTENSION_INVALID_TOKEN_ACCEPTED',
            message: expect.stringContaining('admin ui extension request with invalid bearer token returned HTTP 200'),
          }),
        ]),
      )
      expect(result.checksExecuted.every((execution) => execution.status === 'executed')).toBe(true)
      expect(result.checksExecuted.every((execution) => execution.findings === 1)).toBe(true)
      expect(result.requestResults).toHaveLength(10)
      expect(result.requestResults.find((requestResult) => requestResult.endpoint.url === '/proxy')).toMatchObject({
        id: 'APP_PROXY_UNVERIFIED_SIGNATURE',
        version: 2,
        severity: 'high',
        endpoint: {url: '/proxy', authentication: 'app_proxy'},
        status: 'failed',
        description: '5 of 5 rejection probes were accepted by the endpoint.',
        probes: expect.arrayContaining([
          expect.objectContaining({
            id: 'invalid_signature',
            status: 'failed',
            request: {
              method: 'GET',
              path: '/proxy',
              query: expect.objectContaining({signature: 'invalid-signature'}),
            },
            expected: {outcome: 'rejected'},
            response: {status: 200},
          }),
        ]),
      })
      expect(
        Object.fromEntries(
          result.requestResults.map((requestResult) => [
            requestResult.endpoint.authentication,
            requestResult.remediation.guide,
          ]),
        ),
      ).toMatchObject({
        app_home: 'https://github.com/shop/world/blob/main/areas/apps/shopify-app-packages/docs/verifyAppHomeReq.md',
        admin_ui_extension:
          'https://github.com/shop/world/blob/main/areas/apps/shopify-app-packages/docs/verifyAdminUIExtReq.md',
        checkout_ui_extension:
          'https://github.com/shop/world/blob/main/areas/apps/shopify-app-packages/docs/verifyCheckoutUIExtReq.md',
        customer_account_ui_extension:
          'https://github.com/shop/world/blob/main/areas/apps/shopify-app-packages/docs/verifyCustomerAccountUIExtReq.md',
        pos_ui_extension:
          'https://github.com/shop/world/blob/main/areas/apps/shopify-app-packages/docs/verifyPosUIExtReq.md',
        sidekick_extension:
          'https://github.com/shop/world/blob/main/areas/apps/shopify-app-packages/docs/verifyAdminUIExtReq.md',
        flow_action:
          'https://github.com/shop/world/blob/main/areas/apps/shopify-app-packages/docs/verifyFlowActionReq.md',
        webhook: 'https://github.com/shop/world/blob/main/areas/apps/shopify-app-packages/docs/verifyWebhookReq.md',
        app_proxy: 'https://github.com/shop/world/blob/main/areas/apps/shopify-app-packages/docs/verifyAppProxyReq.md',
      })
      expect(fixture.requests).toHaveLength(20)
      expect(
        fixture.requests.every((request) => request.headers['user-agent'] === 'Shopify-CLI-App-Security-Probe'),
      ).toBe(true)
      expect(
        fixture.requests.some(
          (request) => request.url.pathname === '/proxy' && request.url.searchParams.getAll('shop').length === 2,
        ),
      ).toBe(true)
      expect(fixture.requests.every((request) => request.headers.host?.startsWith('127.0.0.1:'))).toBe(true)
    } finally {
      await close(fixture.server)
    }
  })

  test('does not report endpoints that reject every invalid request', async () => {
    const fixture = await localServer(() => 401)
    try {
      const result = await runRequestSecurityProbes(context(), fixture.url, requestManifest())

      expect(result.issues).toEqual([])
      expect(result.checksExecuted.every((execution) => execution.status === 'executed')).toBe(true)
      expect(result.checksExecuted.every((execution) => execution.findings === 0)).toBe(true)
      expect(result.requestResults.every((requestResult) => requestResult.status === 'passed')).toBe(true)
    } finally {
      await close(fixture.server)
    }
  })

  test('bounds manifest targets and reports omitted endpoints as a coverage gap', async () => {
    const fixture = await localServer(() => 401)
    try {
      const manifest = requestManifest([
        ...defaultRequests().filter((request) => request.method !== 'webhook'),
        ...Array.from({length: 11}, (_, index) => ({url: `/webhooks/${index}`, method: 'webhook' as const})),
      ])

      const result = await runRequestSecurityProbes(context(), fixture.url, manifest)
      const webhookExecution = result.checksExecuted.find((execution) => execution.id === 'WEBHOOK_UNVERIFIED_HMAC')

      expect(webhookExecution).toMatchObject({status: 'unresolved', reason: {code: 'probe_limit'}})
      expect(fixture.requests).toHaveLength(44)
    } finally {
      await close(fixture.server)
    }
  })

  test('records dynamic findings and executions once in the compiled trace', async () => {
    const fixture = await localServer(() => 200)
    try {
      await inTemporaryDirectory(async (directory) => {
        await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Dynamic probe"\n')

        const baseline = await scanApp(directory)
        const execution = await scanApp(directory, undefined, fixture.url, requestManifest())
        const externalFindings = execution.trace.findings.filter((finding) => finding.source === 'external')
        const externalExecutions = execution.trace.checks_executed.filter((check) => check.kind === 'external')

        expect(execution.scan.scan.input_hash).toBe(baseline.scan.scan.input_hash)
        expect(externalFindings.map((finding) => finding.rule_id).sort()).toEqual([
          'APP_HOME_INVALID_TOKEN_ACCEPTED',
          'APP_PROXY_UNVERIFIED_SIGNATURE',
          'FLOW_ACTION_UNVERIFIED_HMAC',
          'UI_EXTENSION_INVALID_TOKEN_ACCEPTED',
          'WEBHOOK_UNVERIFIED_HMAC',
        ])
        expect(externalExecutions).toHaveLength(5)
        expect(externalExecutions.every((execution) => execution.findings === 1)).toBe(true)
        expect(execution.trace.runtime_request_results).toEqual(execution.scan.runtime_request_results)
        expect(execution.trace.runtime_request_results).toHaveLength(10)
        expect(hasRecordedAgentReview(execution.trace)).toBe(false)
      })
    } finally {
      await close(fixture.server)
    }
  })

  test('records unreachable endpoints as coverage gaps instead of findings', async () => {
    const fixture = await localServer(() => 401)
    await close(fixture.server)

    const result = await runRequestSecurityProbes(context(), fixture.url, requestManifest())

    expect(result.issues).toEqual([])
    expect(result.checksExecuted.every((execution) => execution.status === 'unresolved')).toBe(true)
    expect(result.checksExecuted.every((execution) => execution.reason?.code === 'network_unavailable')).toBe(true)
    expect(result.checksExecuted.every((execution) => execution.guidance)).toBe(true)

    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Unreachable probe"\n')
      await expect(scanApp(directory, undefined, fixture.url, requestManifest())).resolves.toMatchObject({
        operation: 'scan',
        trace: {schema_version: 3},
      })
    })
  })
})
