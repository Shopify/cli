import {loopbackServer} from './support/loopback.js'
import {changedPaths, normalizeText, storeRelativePath} from './support/observations.js'
import {
  appAudience,
  appManagementUrl,
  businessAudience,
  businessPlatformUrl,
  clientId,
  now,
  specification,
  test,
} from './support/fixture.js'
import {
  authorizationUrl,
  browserUrl,
  errorReportingUrl,
  mockErrorReport,
  givenFullAuthentication,
  givenInteractiveLink,
  mockRefreshSession,
  mockRemoteConfiguration,
  tokenUrl,
  mockUiSpecification,
  mockLocalizedSpecification,
} from './support/scenarios.js'
import {describe, expect} from 'vitest'
import {stripVTControlCharacters} from 'node:util'
import {stat, utimes} from 'node:fs/promises'

function text(value: string) {
  return stripVTControlCharacters(value).replaceAll('│', '').replace(/\s+/g, ' ').trim()
}
function operations(result: {requests: {operation?: string}[]}) {
  return result.requests.map((request) => request.operation)
}
const linkedOperations = ['UserInfo', 'ActiveAppReleaseFromApiKey', 'FindOrganization', 'fetchSpecifications']

describe.skipIf(process.platform === 'win32').concurrent('app info through bash', () => {
  test('prints remote identity and local configuration, and records local writes', async ({fixture}) => {
    // GIVEN
    await fixture.reserve('linked-app-dev-store')
    await fixture.seedState({appPreferences: {configFile: 'shopify.app.toml', previousAppId: 'preserve-this-id'}})
    const kitBefore = await fixture.readStore('cli-kit')
    // WHEN
    const flags = ['--no-color']
    // THEN
    const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(text(result.stderr)).toContain('App name Remote fixture')
    expect(text(result.stderr)).toContain(`Client ID ${clientId}`)
    expect(text(result.stderr)).toContain('Organization Fixture organization (123)')
    expect(text(result.stderr)).toContain('Access scopes read_products')
    expect(text(result.stderr)).toContain('Dev store fixture.myshopify.com')
    expect(text(result.stderr)).toContain('Update URLs No')
    expect(text(result.stderr)).toContain('User fixture@example.test')
    expect(text(result.stderr)).toContain('Package manager pnpm')
    expect(result.stderr).not.toContain('synthetic-app-secret')
    expect(operations(result)).toEqual(linkedOperations)
    await expect(fixture.readFile('.shopify/.gitignore')).resolves.toBe('# Ignore the entire .shopify directory\n*')
    expect(JSON.parse(await fixture.readFile('.shopify/project.json'))).toEqual({})
    for (const [path, contents] of Object.entries(result.before)) expect(result.after[path]).toBe(contents)
    expect((await fixture.readStore('app'))[fixture.projectPath]).toMatchObject({
      appId: clientId,
      title: 'Remote fixture',
      orgId: '123',
      configFile: 'shopify.app.toml',
      previousAppId: 'preserve-this-id',
    })
    await expect(fixture.readStore('cli-kit')).resolves.toMatchObject(kitBefore)
    expect(changedPaths(result.rootBefore, result.rootAfter)).toEqual(
      [
        storeRelativePath(fixture, 'app'),
        storeRelativePath(fixture, 'cli-kit'),
        'project/.shopify/.gitignore',
        'project/.shopify/project.json',
      ].sort(),
    )
    expect((await fixture.readStore('cli-kit')).cache).toMatchObject({
      'rate-limited-occurrences-report-analytics-event': {value: [now], timestamp: now},
    })
  })

  describe('linking journeys', () => {
    test('forced noninteractive linking rewrites configuration and repeats release/specification reads', async ({
      fixture,
    }) => {
      // GIVEN
      await fixture.reserve('linked-app')
      mockRemoteConfiguration(fixture)
      // WHEN
      const flags = ['--reset', '--client-id', clientId, '--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout).configuration.application_url).toBe('https://remote.example.test')
      await expect(fixture.readFile('shopify.app.toml')).resolves.toContain('https://remote.example.test')
      expect(changedPaths(result.rootBefore, result.rootAfter)).toEqual(
        [
          storeRelativePath(fixture, 'app'),
          storeRelativePath(fixture, 'cli-kit'),
          'project/.shopify/.gitignore',
          'project/.shopify/project.json',
          'project/shopify.app.toml',
        ].sort(),
      )
      expect(operations(result).filter((operation) => operation === 'ActiveAppReleaseFromApiKey')).toHaveLength(2)
      expect(operations(result).filter((operation) => operation === 'fetchSpecifications')).toHaveLength(2)
      expect(result.stderr).toContain('is now linked')
    })

    test('PTY selection links an existing app', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      givenInteractiveLink(fixture, {organizations: 2})
      // WHEN
      const terminal = {
        replies: [
          {waitFor: 'Which organization do you want to use?', input: '\r'},
          {waitFor: 'Create this project as a new app on Shopify?', input: 'n'},
          {waitFor: 'Which existing app is this for?', input: '\r'},
        ],
      }
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', '--reset'], {terminal})
      expect(result.exitCode, result.terminalOutput).toBe(0)
      expect(result.answeredPrompts).toHaveLength(3)
      expect(text(result.terminalOutput)).toContain('CURRENT APP CONFIGURATION')
      expect(operations(result)).toContain('ListOrganizations')
      expect(operations(result)).toContain('listApps')
      expect(operations(result)).not.toContain('CreateApp')
    })

    test('PTY cancellation exits without creating or linking an app', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      givenInteractiveLink(fixture, {organizations: 2})
      const before = await fixture.readFile('shopify.app.toml')
      fixture.mockSubprocess({command: process.platform === 'darwin' ? 'pgrep' : 'ps', exitCode: 1})
      // WHEN
      const terminal = {replies: [{waitFor: 'Which organization do you want to use?', input: '\u0003'}]}
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', '--reset'], {terminal})
      expect(result.exitCode).not.toBe(0)
      expect(operations(result)).not.toContain('CreateApp')
      await expect(fixture.readFile('shopify.app.toml')).resolves.toBe(before)
    })

    test('PTY creation validates a name and selects the latest stable API version', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('unlinked-client-id')
      givenInteractiveLink(fixture, {create: true})
      // WHEN
      const terminal = {
        replies: [
          {waitFor: 'App name', input: 'Fixture creation'},
          {waitFor: 'Fixture creation', input: '\r'},
        ],
      }
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
      expect(result.exitCode, result.terminalOutput).toBe(0)
      const request = result.requests.find((entry) => entry.operation === 'CreateApp')!
      expect(JSON.stringify(request.variables)).toContain('Fixture creation')
      expect(JSON.stringify(request.variables)).toContain('2025-10')
      expect(JSON.stringify(request.variables)).not.toContain('unstable')
      await expect(fixture.readFile('shopify.app.toml')).resolves.toContain(clientId)
    })

    test('stale preferences with multiple replacements use the PTY selection', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('named-staging')
      await fixture.seedState({
        appPreferences: {configFile: 'shopify.app.deleted.toml'},
      })
      // WHEN
      const terminal = {replies: [{waitFor: 'Configuration file', input: '\r'}]}
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
      expect(result.exitCode, result.terminalOutput).toBe(0)
      expect(result.answeredPrompts).toHaveLength(1)
      expect((await fixture.readStore('app'))[fixture.projectPath]).not.toMatchObject({
        configFile: 'shopify.app.deleted.toml',
      })
    })
  })

  describe('linking failures, search, and naming', () => {
    test('search transforms words into a new listApps query before selection', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('unlinked-client-id')
      givenInteractiveLink(fixture)
      const node = {id: fixture.remote.app.id, key: clientId, activeRelease: fixture.remote.app.activeRelease}
      const selectedApp = structuredClone(fixture.remote.app)
      selectedApp.id = 'gid://shopify/App/999'
      selectedApp.key = 'search-result-client-id'
      selectedApp.activeRelease.version.name = 'Search result fixture'
      selectedApp.activeRelease.version.appModules.find((module) => module.handle === 'branding')!.config.name =
        'Search result fixture'
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        variables: {apiKey: selectedApp.key},
        responses: [{body: {data: {app: selectedApp}}}, {body: {data: {app: selectedApp}}}],
      })
      fixture.mockNetwork({
        operation: 'listApps',
        responses: [
          {body: {data: {appsConnection: {edges: [{node}], pageInfo: {hasNextPage: true}}}}},
          {
            body: {
              data: {
                appsConnection: {
                  edges: [{node: {id: selectedApp.id, key: selectedApp.key, activeRelease: selectedApp.activeRelease}}],
                  pageInfo: {hasNextPage: false},
                },
              },
            },
          },
        ],
      })
      // WHEN
      const terminal = {
        replies: [
          {waitFor: 'Create this project as a new app on Shopify?', input: 'n'},
          {waitFor: 'Which existing app is this for?', input: 'red blue'},
          {waitFor: 'Search result fixture', input: '\r'},
        ],
      }
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', '--reset'], {terminal})
      expect(result.exitCode, result.terminalOutput).toBe(0)
      expect(text(result.terminalOutput)).toContain('App name Search result fixture')
      expect(text(result.terminalOutput)).toContain(`Client ID ${selectedApp.key}`)
      await expect(fixture.readFile('shopify.app.toml')).resolves.toContain(`client_id = "${selectedApp.key}"`)
      expect((await fixture.readStore('app'))[fixture.projectPath]).toMatchObject({
        appId: selectedApp.key,
        title: 'Search result fixture',
      })
      expect(
        result.requests
          .filter((request) => request.operation === 'ActiveAppReleaseFromApiKey')
          .map((request) => request.variables),
      ).toEqual([{apiKey: selectedApp.key}, {apiKey: selectedApp.key}])
      expect(
        result.requests
          .filter((request) => request.operation === 'listApps')
          .map((request) => request.variables?.query),
      ).toEqual(['', 'title:red title:blue'])
    })

    test.for([false, true])(
      'configuration collision allows rename or overwrite (rename=%s)',
      async (rename, {fixture}) => {
        // GIVEN
        await fixture.reserve('config-name-collision')
        mockRemoteConfiguration(fixture)
        // WHEN
        const terminal = {
          replies: [
            {waitFor: 'Configuration file name:', input: '\r'},
            {waitFor: 'Do you want to choose a different configuration name?', input: rename ? 'y' : 'n'},
            ...(rename
              ? [
                  {
                    waitFor: 'Configuration file name:',
                    input: [...Array.from({length: 'Remote fixture'.length}, () => '\u007f'), 'staging-new', '\r'],
                  },
                ]
              : []),
          ],
        }
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', '--reset', '--client-id', clientId], {terminal})
        expect(result.exitCode, result.terminalOutput).toBe(0)
        const filename = rename ? 'shopify.app.staging-new.toml' : 'shopify.app.remote-fixture.toml'
        await expect(fixture.readFile(filename)).resolves.toContain(clientId)
        await expect(fixture.readFile('shopify.app.toml')).resolves.toContain('other-client')
        expect((await fixture.readStore('app'))[fixture.projectPath]).toMatchObject({configFile: filename})
      },
    )

    test.for([
      {name: '', error: "App name can't be empty"},
      {name: 'x'.repeat(31), error: 'Enter a shorter name'},
      {name: 'shopify', error: "Name can't contain"},
    ])('invalid app name $name cannot reach creation', async ({name, error}, {fixture}) => {
      // GIVEN
      await fixture.reserve('unlinked-client-id')
      givenInteractiveLink(fixture, {create: true})
      fixture.mockSubprocess({command: process.platform === 'darwin' ? 'pgrep' : 'ps', exitCode: 1})
      // WHEN
      const terminal = {
        replies: [
          {waitFor: 'App name', input: name ? [name, '\r'] : '\r'},
          {waitFor: error, input: '\u0003'},
        ],
      }
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
      expect(result.exitCode).not.toBe(0)
      expect(text(result.terminalOutput)).toContain(error)
      expect(operations(result)).not.toContain('CreateApp')
    })

    test.for([false, true])(
      'creation failure preserves local TOML (failure after creation=%s)',
      async (afterCreation, {fixture}) => {
        // GIVEN
        await fixture.reserve('unlinked-client-id')
        const original = 'client_id = ""\n'
        givenInteractiveLink(fixture, {create: true})
        if (afterCreation)
          fixture.mockNetwork({
            operation: 'ActiveAppReleaseFromApiKey',
            responses: [{status: 403, body: {errors: [{message: 'Later release failure'}]}}],
          })
        else
          fixture.mockNetwork({
            operation: 'CreateApp',
            responses: [
              {
                body: {
                  data: {
                    appCreate: {app: null, userErrors: [{category: 'invalid', message: 'Creation refused', on: {}}]},
                  },
                },
              },
            ],
          })
        // WHEN
        const terminal = {
          replies: [
            {waitFor: 'App name', input: 'Fixture creation'},
            {waitFor: 'Fixture creation', input: '\r'},
          ],
        }
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
        expect(result.exitCode).not.toBe(0)
        expect(text(result.terminalOutput)).toContain(afterCreation ? 'Later release failure' : 'Creation refused')
        expect(operations(result).filter((operation) => operation === 'CreateApp')).toHaveLength(1)
        await expect(fixture.readFile('shopify.app.toml')).resolves.toBe(original)
        expect(operations(result).filter((operation) => /delete/i.test(operation ?? ''))).toEqual([])
      },
    )
  })

  describe('device authorization journeys', () => {
    test.for([false, true])('full device authentication completes (pending=%s)', async (pending, {fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await givenFullAuthentication(fixture, pending ? [{status: 400, body: {error: 'authorization_pending'}}] : [])
      // WHEN
      const terminal = {replies: []}
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
      expect(result.exitCode, result.terminalOutput).toBe(0)
      expect(text(result.terminalOutput)).toContain('User fixture@example.test')
      expect(
        result.requests.filter((request) =>
          new URLSearchParams(request.body).get('grant_type')?.endsWith('device_code'),
        ),
      ).toHaveLength(pending ? 2 : 1)
      const stored = JSON.parse((await fixture.readStore('cli-kit')).sessionStore as string)
      expect(stored['accounts.shopify.com']['synthetic-user'].identity.alias).toBe('login@example.test')
    })

    test('desktop login invokes only the scripted browser opener', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await givenFullAuthentication(fixture)
      fixture.configure({
        environment: {
          CODESPACES: undefined,
        },
      })
      fixture.mockSubprocess({command: process.platform === 'darwin' ? 'open' : 'xdg-open', args: [browserUrl]})
      // WHEN
      const terminal = {replies: []}
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
      expect(result.exitCode, result.terminalOutput).toBe(0)
      expect(
        result.events.filter((event) => event.type === 'spawn').some((event) => event.args?.includes(browserUrl)),
      ).toBe(true)
      expect(text(result.terminalOutput)).toContain('Opened link to start the auth process')
    })

    test.for(['access_denied', 'expired_token'])(
      'device polling %s aborts before app lookup',
      async (error, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        await givenFullAuthentication(fixture, [{status: 400, body: {error}}])
        // WHEN
        const terminal = {replies: []}
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
        expect(result.exitCode).not.toBe(0)
        expect(text(result.terminalOutput)).toContain('Device authorization failed')
        expect(operations(result)).not.toContain('ActiveAppReleaseFromApiKey')
      },
    )
  })

  describe('polling and authentication edge cases', () => {
    test('slow_down increases the next polling interval', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await givenFullAuthentication(fixture, [{status: 400, body: {error: 'slow_down'}}])
      // WHEN
      const terminal = {replies: []}
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
      expect(result.exitCode, result.terminalOutput).toBe(0)
      const polls = result.requests.filter((request) =>
        new URLSearchParams(request.body).get('grant_type')?.endsWith('device_code'),
      )
      expect(polls).toHaveLength(2)
      expect(polls[1]!.elapsedMs! - polls[0]!.elapsedMs!).toBeGreaterThanOrEqual(4900)
    })

    test('endless pending authorization remains bounded by the harness deadline', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({
        requestLimit: 100,
      })
      await givenFullAuthentication(fixture)
      const start = fixture.networkMocks.find((request) => request.url === authorizationUrl)!
      start.responses = [
        {
          body: {
            device_code: 'fixture-device',
            user_code: 'FIXTURE',
            verification_uri_complete: browserUrl,
            verification_uri: browserUrl,
            interval: 0.1,
            expires_in: 0,
          },
        },
      ]
      const poll = fixture.networkMocks.find((request) => request.form?.grant_type?.endsWith('device_code'))!
      poll.responses = [{status: 400, body: {error: 'authorization_pending'}}]
      poll.repeatLastResponse = true
      // WHEN
      const terminal = {replies: []}
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info'], {terminal, timeoutMs: 5000, allowTimeout: true})
      expect(result.timedOut).toBe(true)
      expect(result.requests.filter((request) => request.url === tokenUrl).length).toBeGreaterThan(1)
      expect(operations(result)).not.toContain('ActiveAppReleaseFromApiKey')
    })

    test('UserEmail failure falls back to the user ID without preventing app info', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await givenFullAuthentication(fixture)
      fixture.mockNetwork({
        operation: 'UserEmail',
        responses: [{status: 403, body: {errors: [{message: 'Email unavailable'}]}}],
      })
      // WHEN
      const terminal = {replies: []}
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
      expect(result.exitCode, result.terminalOutput).toBe(0)
      const sessions = JSON.parse((await fixture.readStore('cli-kit')).sessionStore as string)
      expect(sessions['accounts.shopify.com']['synthetic-user'].identity.alias).toBe('synthetic-user')
    })

    test('valid device authorization response in CI aborts without polling', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await givenFullAuthentication(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.requests.map((request) => request.url)).toEqual([authorizationUrl])
      expect(text(result.stderr)).toContain('Authorization is required')
    })

    test.for(['app-management', 'business-platform'])(
      'automation exchange rejection identifies the failed %s API',
      async (api, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        fixture.configure({
          environment: {
            SHOPIFY_APP_AUTOMATION_TOKEN: 'synthetic-automation',
          },
        })
        fixture.mockTokenExchange(appAudience, 'synthetic-app-token')
        fixture.mockTokenExchange(businessAudience, 'synthetic-business-token')
        fixture.networkMocks.find(
          (request) => request.form?.audience === (api === 'app-management' ? appAudience : businessAudience),
        )!.responses = [{status: 400, body: {error: 'invalid_target'}}]
        // WHEN
        const flags = ['--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode).not.toBe(0)
        expect(result.stdout).toBe('')
        expect(text(result.stderr)).toContain("The custom token provided can't be used")
        expect(result.requests).toHaveLength(api === 'app-management' ? 1 : 2)
      },
    )

    test('empty new automation variable suppresses the legacy-token fallback', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({
        environment: {
          SHOPIFY_APP_AUTOMATION_TOKEN: '',
        },
      })
      fixture.configure({
        environment: {
          SHOPIFY_CLI_PARTNERS_TOKEN: 'synthetic-legacy-token',
        },
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(operations(result)).toEqual(linkedOperations)
    })
  })

  describe('OAuth response and exchange failures', () => {
    test.for([
      {
        name: 'missing ID token',
        response: {body: {access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600, scope: 'openid'}},
        message: 'No id_token',
        reportError: true,
      },
      {
        name: 'invalid ID token',
        response: {
          body: {
            access_token: 'new-token',
            refresh_token: 'new-refresh',
            expires_in: 3600,
            scope: 'openid',
            id_token: 'not-a-jwt',
          },
        },
        message: 'Invalid JWT',
        reportError: true,
      },
      {
        name: 'non-JSON success',
        response: {text: '<html>not JSON</html>'},
        message: 'Received invalid response from authentication service',
        reportError: false,
      },
    ])(
      'rejects device-token $name without persisting credentials or loading the app',
      async ({response, message, reportError}, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        await givenFullAuthentication(fixture)
        fixture.networkMocks.find((request) => request.form?.grant_type?.endsWith('device_code'))!.responses = [
          response,
        ]
        if (reportError) mockErrorReport(fixture)
        // WHEN
        const terminal = {replies: []}
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
        expect(result.exitCode).toBe(1)
        expect(text(result.terminalOutput)).toContain(message)
        expect(result.terminalOutput).not.toContain('CURRENT APP CONFIGURATION')
        expect(result.requests.filter((request) => new URLSearchParams(request.body).has('audience'))).toEqual([])
        expect(operations(result)).not.toContain('ActiveAppReleaseFromApiKey')
        expect(JSON.stringify(await fixture.readStore('cli-kit'))).not.toContain('new-token')
        // Error metadata performs a local load even though authentication failed.
        expect(changedPaths(result.after, result.before)).toEqual(['.shopify/.gitignore', '.shopify/project.json'])
        expect(changedPaths(result.rootBefore, result.rootAfter)).toEqual([
          'project/.shopify/.gitignore',
          'project/.shopify/project.json',
        ])
      },
    )

    test.for([
      appAudience,
      businessAudience,
      'ee139b3d-5861-4d45-b387-1bc3ada7811c',
      '271e16d403dfa18082ffb3d197bd2b5f4479c3fc32736d69296829cbb28d41a6',
    ])(
      'an independent user-token exchange failure for %s prevents the report and session persistence',
      async (audience, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        await givenFullAuthentication(fixture)
        fixture.networkMocks.find((request) => request.form?.audience === audience)!.responses = [
          {status: 400, body: {error: 'invalid_target'}},
        ]
        // WHEN
        const terminal = {replies: []}
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
        expect(result.exitCode).toBe(1)
        expect(text(result.terminalOutput)).toContain('You are not authorized to use the CLI')
        expect(result.terminalOutput).not.toContain('CURRENT APP CONFIGURATION')
        expect(result.requests.some((request) => new URLSearchParams(request.body).get('audience') === audience)).toBe(
          true,
        )
        expect(operations(result)).not.toContain('ActiveAppReleaseFromApiKey')
        expect(JSON.stringify(await fixture.readStore('cli-kit'))).not.toContain('synthetic-new-identity')
      },
    )
  })

  describe('unauthorized recovery and cache boundaries', () => {
    test.for(['ActiveAppReleaseFromApiKey', 'FindOrganization'])(
      '401 refreshes and replays %s with the right audience',
      async (operation, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        const request = fixture.networkMocks.find((entry) => entry.operation === operation)!
        const success = request.responses[0]!
        const refreshed = {app: 'refreshed-app-token', business: 'refreshed-business-token'}
        const oldAuthorization = request.headers!.Authorization
        const newAuthorization = `Bearer ${operation === 'FindOrganization' ? refreshed.business : refreshed.app}`
        fixture.mockNetwork({operation, responses: [{status: 401, body: {errors: [{message: 'Unauthorized'}]}}]})
        // Subsequent operations and the replay must use the newly exchanged tokens.
        for (const subsequent of fixture.networkMocks.slice(fixture.networkMocks.indexOf(request) + 1)) {
          subsequent.headers = {
            Authorization: `Bearer ${subsequent.url === businessPlatformUrl ? refreshed.business : refreshed.app}`,
          }
        }
        fixture.mockNetwork({...request, headers: {Authorization: newAuthorization}, responses: [success]})
        mockRefreshSession(fixture, refreshed)
        // WHEN
        const flags = ['--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode, result.stderr).toBe(0)
        const attempts = result.requests.filter((entry) => entry.operation === operation)
        expect(attempts.map((entry) => entry.headers?.authorization)).toEqual([oldAuthorization, newAuthorization])
        expect(
          result.requests.filter((entry) => new URLSearchParams(entry.body).get('grant_type') === 'refresh_token'),
        ).toHaveLength(1)
        const exchanges = result.requests.filter((entry) => new URLSearchParams(entry.body).has('audience'))
        expect(exchanges).toHaveLength(4)
        for (const exchange of exchanges) {
          expect(new URLSearchParams(exchange.body).get('subject_token')).toBe('synthetic-refreshed-identity')
        }
        const stored = JSON.parse((await fixture.readStore('cli-kit')).sessionStore as string)
        expect(stored['accounts.shopify.com']['synthetic-user']).toMatchObject({
          identity: {accessToken: 'synthetic-refreshed-identity', refreshToken: 'synthetic-refreshed-refresh'},
          applications: {
            [appAudience]: {accessToken: refreshed.app},
            [businessAudience]: {accessToken: refreshed.business},
          },
        })
        expect(JSON.parse(result.stdout).organization).toEqual({id: '123', businessName: 'Fixture organization'})
        expect(result.stderr).toBe('')
      },
    )

    test('persistent 401 stops after the refreshed replay', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [
          ...Array.from({length: 2}, () => ({status: 401, body: {errors: [{message: 'Still unauthorized'}]}})),
        ],
      })
      mockRefreshSession(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(operations(result).filter((operation) => operation === 'ActiveAppReleaseFromApiKey')).toHaveLength(2)
      expect(operations(result)).not.toContain('FindOrganization')
    })

    test('no-prompt refresh failure aborts instead of opening a browser', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [{status: 401, body: {errors: [{message: 'Unauthorized'}]}}],
      })
      fixture.mockNetwork({
        method: 'POST',
        url: tokenUrl,
        form: {grant_type: 'refresh_token'},
        responses: [{status: 400, body: {error: 'invalid_grant'}}],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.requests.some((request) => request.url === authorizationUrl)).toBe(false)
      expect(result.events.filter((event) => event.type === 'spawn')).toEqual([])
      await expect(fixture.readStore('cli-kit')).resolves.not.toHaveProperty('sessionStore')
    })

    test('initial refresh invalid_grant falls back to full authentication', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      const user = structuredClone(fixture.user)
      user.identity.expiresAt = '2000-01-01T00:00:00Z'
      await givenFullAuthentication(fixture)
      await fixture.seedState({
        authentication: {
          sessions: {
            'accounts.shopify.com': {
              'synthetic-user': user,
            },
          },
        },
      })
      fixture.mockNetwork({
        method: 'POST',
        url: tokenUrl,
        form: {grant_type: 'refresh_token'},
        responses: [{status: 400, body: {error: 'invalid_grant'}}],
      })
      // WHEN
      const terminal = {replies: []}
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
      expect(result.exitCode, result.terminalOutput).toBe(0)
      expect(result.requests.some((request) => request.url === authorizationUrl)).toBe(true)
      expect(operations(result)).toContain('ActiveAppReleaseFromApiKey')
    })

    test.for([-1, 0, 1])('query cache expiry boundary offset %s milliseconds', async (offset, {fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await fixture.runShopifyCommand(['app', 'info', '--json'])
      const store = await fixture.readStore('cli-kit')
      const cache = store.cache as Record<
        string,
        {
          timestamp: number
          value: unknown
        }
      >
      for (const [key, value] of Object.entries(cache))
        if (key.startsWith('q-')) value.timestamp = now - 6 * 60 * 60 * 1000 - offset
      await fixture.seedState({
        caches: cache,
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(operations(result)).toEqual(
        offset < 0 ? ['ActiveAppReleaseFromApiKey', 'fetchSpecifications'] : linkedOperations,
      )
    })

    test('corrupt query cache fails without a silent network refresh', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await fixture.runShopifyCommand(['app', 'info', '--json'])
      const cache = (await fixture.readStore('cli-kit')).cache as Record<
        string,
        {
          timestamp: number
          value: unknown
        }
      >
      const key = Object.keys(cache).find((key) => key.startsWith('q-') && key.endsWith('-synthetic-user'))!
      cache[key]!.value = '{invalid'
      await fixture.seedState({
        caches: cache,
      })
      mockErrorReport(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(operations(result)).not.toContain('UserInfo')
      expect(result.stdout).toBe('')
    })

    test('expired Business Platform credentials reach the API without proactive refresh', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      const user = structuredClone(fixture.user)
      user.applications[businessAudience].expiresAt = '2000-01-01T00:00:00Z'
      await fixture.seedState({
        authentication: {
          sessions: {
            'accounts.shopify.com': {
              'synthetic-user': user,
            },
          },
        },
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(operations(result)).toEqual(linkedOperations)
      expect(result.requests[0]!.headers?.authorization).toBe('Bearer synthetic-business-token')
    })
  })

  describe('multiple accounts and credential selection', () => {
    test.for([undefined, 'secondary'])(
      'alias override chooses the first matching account and preserves saved selection %s',
      async (selected, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        const secondary = structuredClone(fixture.user)
        secondary.identity.userId = 'secondary'
        secondary.applications[businessAudience].accessToken = 'wrong-account-token'
        await fixture.seedState({
          authentication: {
            currentSessionId: selected,
            sessions: {'accounts.shopify.com': {'synthetic-user': fixture.user, secondary}},
          },
        })
        // WHEN
        const flags = ['--auth-alias', 'fixture', '--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode).toBe(0)
        expect(result.requests[0]!.headers?.authorization).toBe('Bearer synthetic-business-token')
        expect((await fixture.readStore('cli-kit')).currentSessionId).toBe(selected)
      },
    )

    test('absent saved selection uses the first account without persisting a default', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      const secondary = structuredClone(fixture.user)
      secondary.identity.userId = 'secondary'
      secondary.applications[businessAudience].accessToken = 'wrong-account-token'
      await fixture.seedState({
        authentication: {
          currentSessionId: undefined,
          sessions: {'accounts.shopify.com': {'synthetic-user': fixture.user, secondary}},
        },
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.requests[0]!.headers?.authorization).toBe('Bearer synthetic-business-token')
      await expect(fixture.readStore('cli-kit')).resolves.not.toHaveProperty('currentSessionId')
    })

    test('stale saved selection does not fall back to another stored account', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await fixture.seedState({
        authentication: {
          currentSessionId: 'missing-user',
        },
      })
      fixture.mockNetwork({
        method: 'POST',
        url: authorizationUrl,
        responses: [{body: {device_code: 'fixture', verification_uri_complete: browserUrl}}],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.requests.map((request) => request.url)).toEqual([authorizationUrl])
    })

    test('organization cache is reused across accounts while UserInfo is not', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await fixture.runShopifyCommand(['app', 'info', '--json'])
      const secondary = structuredClone(fixture.user)
      secondary.identity.userId = 'secondary'
      secondary.applications[businessAudience].accessToken = 'secondary-business-token'
      await fixture.seedState({
        authentication: {
          currentSessionId: 'secondary',
          sessions: {'accounts.shopify.com': {'synthetic-user': fixture.user, secondary}},
        },
      })
      for (const request of fixture.networkMocks)
        if (request.url === businessPlatformUrl) request.headers = {Authorization: 'Bearer secondary-business-token'}
      fixture.mockNetwork({
        operation: 'UserInfo',
        responses: [
          {
            body: {
              data: {
                currentUserAccount: {uuid: 'secondary', email: 'secondary@example.test', organizations: {nodes: []}},
              },
            },
          },
        ],
      })
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(text(result.stderr)).toContain('User secondary@example.test')
      expect(operations(result)).toEqual(['UserInfo', 'ActiveAppReleaseFromApiKey', 'fetchSpecifications'])
    })

    test.for([appAudience, businessAudience])(
      'missing audience %s has its documented refresh boundary',
      async (audience, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        const applications: Record<string, unknown> = {...fixture.user.applications}
        delete applications[audience]
        await fixture.seedState({
          authentication: {
            sessions: {
              'accounts.shopify.com': {'synthetic-user': {identity: fixture.user.identity, applications}},
            },
          },
        })
        if (audience === appAudience) mockRefreshSession(fixture)
        else mockErrorReport(fixture)
        // WHEN
        const flags = ['--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode === 0).toBe(audience === appAudience)
        expect(result.requests.some((request) => request.url === tokenUrl)).toBe(audience === appAudience)
        if (audience === businessAudience) expect(result.stdout).toBe('')
      },
    )

    test.for([0, 2])('legacy automation credentials with %s organizations', async (count, {fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({
        environment: {
          SHOPIFY_CLI_PARTNERS_TOKEN: 'synthetic-legacy-token',
        },
      })
      fixture.mockTokenExchange(appAudience, 'synthetic-app-token')
      fixture.mockTokenExchange(businessAudience, 'synthetic-business-token')
      fixture.mockNetwork({
        operation: 'UserInfo',
        responses: [
          {
            body: {
              data: {
                currentUserAccount: {
                  uuid: 'service',
                  email: 'service@example.test',
                  organizations: {nodes: Array.from({length: count}, () => ({name: 'Fixture organization'}))},
                },
              },
            },
          },
        ],
      })
      if (count === 2) mockErrorReport(fixture)
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode === 0).toBe(count === 0)
      expect(text(result.stderr)).toContain(
        count === 0 ? 'Service account Unknown organization' : 'Multiple organizations found for the CLI token',
      )
    })
  })

  describe('loopback transport boundaries', () => {
    test('native schema fetch follows a real loopback redirect', async ({fixture, onTestFinished}) => {
      // GIVEN
      await fixture.reserve('ui-tools-missing-file')
      const server = await loopbackServer((request, response) => {
        if (request.url === '/redirect') {
          response.writeHead(302, {Location: '/schema.json'})
          response.end()
          return
        }
        response.writeHead(200, {'Content-Type': 'application/json'})
        response.end(JSON.stringify({type: 'object', properties: {loopbackField: {type: 'string'}}}))
      })
      onTestFinished(server.close)
      fixture.configure({
        loopbackPorts: [server.port],
      })
      mockUiSpecification(fixture)
      await fixture.writeFile(
        'extensions/ui/tools.json',
        JSON.stringify([{name: 'lookup', description: '', inputSchema: {$ref: `${server.url}/redirect`}}]),
      )
      fixture.mockNetwork({method: 'GET', url: `${server.url}/redirect`, passthrough: true, responses: []})
      fixture.mockNetwork({method: 'GET', url: `${server.url}/schema.json`, passthrough: true, responses: []})
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      expect(server.paths).toEqual(['/redirect', '/schema.json'])
      await expect(fixture.readFile('extensions/ui/shopify.d.ts')).resolves.toContain('loopbackField')
    })

    test('socket failure prints the report but leaves the schema resolver timer alive', async ({
      fixture,
      onTestFinished,
    }) => {
      // GIVEN
      await fixture.reserve('ui-tools-missing-file')
      const server = await loopbackServer((request) => request.socket.destroy())
      onTestFinished(server.close)
      fixture.configure({
        loopbackPorts: [server.port],
      })
      mockUiSpecification(fixture)
      await fixture.writeFile(
        'extensions/ui/tools.json',
        JSON.stringify([{name: 'lookup', description: '', inputSchema: {$ref: `${server.url}/schema.json`}}]),
      )
      fixture.mockNetwork({method: 'GET', url: `${server.url}/schema.json`, passthrough: true, responses: []})
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags], {
        timeoutMs: 15000,
        terminateAfterStdout: (stdout) => {
          try {
            JSON.parse(stdout)
            return true
          } catch (error) {
            if (error instanceof SyntaxError) return false
            throw error
          }
        },
      })
      // The dependency clears its 60-second timer only after a successful fetch.
      // Characterize the hang after the complete report arrives, without waiting a minute.
      expect(result.terminatedAfterStdout).toBe(true)
      expect(result.timedOut).toBe(false)
      expect(JSON.parse(result.stdout).configuration.client_id).toBe(clientId)
      expect(server.paths).toContain('/schema.json')
      expect(result.stderr).toContain('Failed to create tools type definition')
    })
  })

  describe('response envelopes and request deadlines', () => {
    test.for([false, true])(
      'transient socket failure obeys skip-network-retry=%s',
      async (skip, {fixture, onTestFinished}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        let attempts = 0
        const server = await loopbackServer((request, response) => {
          attempts += 1
          if (attempts === 1) {
            request.socket.destroy()
            return
          }
          response.writeHead(200, {'Content-Type': 'application/json'})
          response.end(JSON.stringify({data: {app: fixture.remote.app}}))
        })
        onTestFinished(server.close)
        fixture.configure({
          loopbackPorts: [server.port],
          environment: {SHOPIFY_CLI_SKIP_NETWORK_LEVEL_RETRY: skip ? '1' : undefined},
        })
        // Redirect the intercepted API call to an owned socket, never a real service.
        fixture.mockNetwork({
          operation: 'ActiveAppReleaseFromApiKey',
          responses: [{status: 307, headers: {Location: `${server.url}/graphql`}}],
          repeatLastResponse: true,
        })
        fixture.mockNetwork({method: 'POST', url: `${server.url}/graphql`, passthrough: true, responses: []})
        // WHEN
        const argv = ['app', 'info', '--json']
        // THEN
        const result = await fixture.runShopifyCommand(argv)
        expect(result.exitCode, result.stderr).toBe(skip ? 1 : 0)
        expect(
          result.requests.filter(
            (request) => request.url === appManagementUrl && request.operation === 'ActiveAppReleaseFromApiKey',
          ),
        ).toHaveLength(skip ? 1 : 2)
        expect(server.paths).toEqual(skip ? ['/graphql'] : ['/graphql', '/graphql'])
        if (skip) {
          expect(result.stdout).toBe('')
          // A peer reset can surface either message depending on socket timing/OS.
          expect(text(result.stderr)).toMatch(/socket hang up|ECONNRESET/)
          expect(text(result.stderr)).toContain(`${server.url}/graphql`)
          expect(operations(result)).not.toContain('FindOrganization')
        } else {
          expect(JSON.parse(result.stdout).configuration.client_id).toBe(clientId)
          expect(result.stderr).toBe('')
        }
      },
    )

    test.for(['', '<html>proxy failure</html>', '{broken'])('rejects response body %j', async (body, {fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [{text: body}],
      })
      mockErrorReport(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(operations(result)).not.toContain('FindOrganization')
    })

    test.for([{}, {data: null}, {data: {app: {activeRelease: null}}}])(
      'rejects malformed response envelope %j',
      async (body, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        fixture.mockNetwork({
          operation: 'ActiveAppReleaseFromApiKey',
          responses: [{body}],
        })
        mockErrorReport(fixture)
        // WHEN
        const flags = ['--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode).not.toBe(0)
        expect(result.stdout).toBe('')
      },
    )

    test.for(['THROTTLED', '429', 429])(
      'GraphQL throttle code %j uses only string retry codes',
      async (code, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        fixture.mockNetwork({
          operation: 'ActiveAppReleaseFromApiKey',
          responses: [
            {headers: {'Retry-After': '0'}, body: {errors: [{message: 'Throttled', extensions: {code}}]}},
            {body: {data: {app: fixture.remote.app}}},
          ],
        })
        // WHEN
        const flags = ['--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode, result.stderr).toBe(typeof code === 'number' ? 1 : 0)
        expect(operations(result).filter((operation) => operation === 'ActiveAppReleaseFromApiKey')).toHaveLength(
          typeof code === 'number' ? 1 : 2,
        )
      },
    )

    test('a response past the request deadline cannot become a successful report', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({
        environment: {
          SHOPIFY_CLI_MAX_REQUEST_TIME_FOR_NETWORK_CALLS: '500',
        },
      })
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [{delayMs: 1500, body: {data: {app: fixture.remote.app}}}],
      })
      mockErrorReport(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.timedOut).toBe(false)
      expect(result.stdout).toBe('')
      expect(operations(result)).not.toContain('FindOrganization')
    })

    test('present response extensions without deprecations expose the callback failure', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [{body: {data: {app: fixture.remote.app}, extensions: {}}}],
      })
      mockErrorReport(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('deprecations')
    })
  })

  describe('discovery and filesystem boundaries', () => {
    test('inactive config web directories restrict default discovery', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('inactive-web-directories')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).webs).toHaveLength(1)
      expect(JSON.parse(result.stdout).webs[0].directory).toContain('other')
    })

    test('hidden web files are discovered but node_modules web files are excluded', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('hidden-web-discovery')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(2)
      expect(JSON.parse(result.stdout).webs).toHaveLength(2)
      expect(result.stdout).not.toContain('node_modules/dependency')
    })

    test.for([
      {fixtureName: 'hidden-null', contents: 'null'},
      {fixtureName: 'hidden-boolean', contents: 'true'},
      {fixtureName: 'hidden-number', contents: '42'},
      {fixtureName: 'hidden-array', contents: '[]'},
    ])('hidden project JSON root $fixtureName has its own outcome', async ({fixtureName, contents}, {fixture}) => {
      // GIVEN
      await fixture.reserve(fixtureName)
      if (contents === 'null') mockErrorReport(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode === 0).toBe(contents !== 'null')
      await expect(fixture.readFile('.shopify/project.json')).resolves.toBe(contents)
    })

    test('a file where .shopify must be a directory aborts required writes', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('hidden-directory-collision')
      mockErrorReport(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      await expect(fixture.readFile('.shopify')).resolves.toBe('not a directory')
    })

    test('dev-store TOML including an empty string takes precedence over hidden state', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('empty-dev-store')
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.stderr).not.toContain('hidden.myshopify.com')
      expect(text(result.stderr)).not.toContain('Dev store Not yet configured')
    })

    test('nearest project marker wins over a higher-priority ancestor marker', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('package-marker-ancestor')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).packageManager).toBe('npm')
    })

    test.for(['yarn', 'pnpm', 'bun', 'npm'])(
      'package manager falls back to %s user-agent without markers',
      async (manager, {fixture}) => {
        // GIVEN
        await fixture.reserve('no-package-manager-marker')
        fixture.configure({
          environment: {
            npm_config_user_agent: `${manager}/1.0.0`,
          },
        })
        // WHEN
        const flags = ['--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode).toBe(0)
        expect(JSON.parse(result.stdout).packageManager).toBe(manager)
      },
    )

    test('workspace marker presence is independent of its bytes', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('workspace-marker')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).usesWorkspaces).toBe(true)
    })

    test('nested invocation reads root preference but writes metadata under the invoked path', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('named-staging')
      await fixture.seedState({
        appPreferences: {configFile: 'shopify.app.staging.toml'},
      })
      // WHEN
      const cwd = fixture.path('web')
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', '--json'], {cwd})
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).configuration.name).toBe('Staging')
      expect((await fixture.readStore('app'))[cwd]).toMatchObject({title: 'Remote fixture'})
    })
  })

  describe('web normalization and historical linked configurations', () => {
    test.for([
      {
        fixtureName: 'web-roles-win',
        roles: ['backend'],
        extra: {
          auth_callback_path: ['/auth/callback', '/second'],
          webhooks_path: '/hooks',
          port: 65536,
          hmr_server: {http_paths: ['hmr']},
          commands: {dev: '', build: 'never-build', predev: 'never-predev'},
        },
      },
      {fixtureName: 'web-invalid-roles-fallback', roles: ['background'], extra: {auth_callback_path: '/callback'}},
      {fixtureName: 'web-default-frontend', roles: ['frontend'], extra: {}},
      {fixtureName: 'web-empty-roles', roles: [], extra: {}},
      {fixtureName: 'web-port-zero', roles: ['frontend'], extra: {port: 0}},
      {fixtureName: 'web-port-fraction', roles: ['frontend'], extra: {port: 1.5}},
    ])('normalizes $fixtureName without rewriting or executing it', async ({fixtureName, roles, extra}, {fixture}) => {
      // GIVEN
      await fixture.reserve(fixtureName)
      // WHEN
      const argv = ['app', 'info', '--json']
      // THEN
      const result = await fixture.runShopifyCommand(argv)
      expect(result.exitCode, result.stderr).toBe(0)
      const report = JSON.parse(result.stdout)
      expect(report.webs).toHaveLength(1)
      expect(report.webs[0].configuration).toMatchObject({roles, ...extra})
      expect(report.webs[0].configuration).not.toHaveProperty('type')
      expect(report.webs[0].configuration).not.toHaveProperty('unknown')
      expect(result.after['web/shopify.web.toml']).toBe(result.before['web/shopify.web.toml'])
      expect(result.events.filter((event) => event.type === 'spawn')).toEqual([])
      expect(result.stderr).toBe('')
    })

    test.for([
      {fixtureName: 'web-both-branches-invalid', field: 'roles'},
      {fixtureName: 'web-hmr-missing-paths', field: 'http_paths'},
      {fixtureName: 'web-port-negative', field: 'port'},
      {fixtureName: 'web-port-too-large', field: 'port'},
      {fixtureName: 'web-port-string', field: 'port'},
    ])('reports the rejected web field in $fixtureName', async ({fixtureName, field}, {fixture}) => {
      // GIVEN
      await fixture.reserve(fixtureName)
      // WHEN
      const argv = ['app', 'info', '--json']
      // THEN
      const result = await fixture.runShopifyCommand(argv)
      expect(result.exitCode, result.stderr).toBe(2)
      const report = JSON.parse(result.stdout)
      expect(report.configuration.client_id).toBe(clientId)
      expect(report.webs).toEqual([])
      expect(JSON.stringify(report.errors)).toContain(field)
      expect(result.after['web/shopify.web.toml']).toBe(result.before['web/shopify.web.toml'])
      expect(result.stderr).toBe('')
    })

    test('reports the detected framework from web dependencies rather than the web name', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('web-remix-framework')
      // WHEN
      const argv = ['app', 'info', '--json']
      // THEN
      const result = await fixture.runShopifyCommand(argv)
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).webs[0]).toMatchObject({
        framework: 'remix',
        configuration: {name: 'Fixture web'},
      })
      expect(result.stderr).toBe('')
      expect(result.events.filter((event) => event.type === 'spawn')).toEqual([])
    })

    test.for([
      {
        fixtureName: 'linked-legacy-privacy',
        expectedFields: {
          webhooks: {
            api_version: '2023-07',
            privacy_compliance: {
              customer_deletion_url: '/privacy/delete',
              customer_data_request_url: '/privacy/data',
              shop_deletion_url: '/privacy/shop',
            },
          },
        },
      },
      {
        fixtureName: 'linked-uri-shorthand',
        // The current loader drops the unsupported top-level URI/topics from the report.
        expectedFields: {webhooks: {api_version: '2023-10'}},
      },
      {
        fixtureName: 'linked-old-subscription',
        // sub_topic and metafield_namespaces are not retained in the normalized report.
        expectedFields: {
          webhooks: {api_version: '2024-01', subscriptions: [{topics: ['orders/create'], uri: '/hooks'}]},
        },
      },
      {
        fixtureName: 'linked-required-scopes',
        expectedFields: {
          build: {include_config_on_deploy: true},
          access_scopes: {required_scopes: ['read_products', 'write_products'], optional_scopes: ['read_orders']},
          webhooks: {
            api_version: '2025-10',
            subscriptions: [
              {compliance_topics: ['customers/data_request', 'customers/redact', 'shop/redact'], uri: '/privacy'},
            ],
          },
        },
      },
    ])(
      'normalizes linked compatibility input $fixtureName without rewriting it',
      async ({fixtureName, expectedFields}, {fixture}) => {
        // GIVEN
        await fixture.reserve(fixtureName)
        fixture.remote.specifications.push(
          ...['webhooks', 'webhook_subscription', 'privacy_compliance_webhooks'].map((id) => specification(id)),
        )
        // WHEN
        const argv = ['app', 'info', '--json']
        // THEN
        const result = await fixture.runShopifyCommand(argv)
        expect(result.exitCode, result.stderr).toBe(0)
        expect(result.stderr).toBe('')
        const report = JSON.parse(result.stdout)
        expect(report.configuration).toEqual({
          client_id: clientId,
          name: 'Local fixture',
          application_url: 'https://fixture.example.test',
          embedded: true,
          access_scopes: {scopes: 'read_products'},
          auth: {redirect_urls: ['https://fixture.example.test/auth/callback']},
          ...expectedFields,
        })
        expect(report.errors).toEqual({errors: []})
        expect(result.after['shopify.app.toml']).toBe(result.before['shopify.app.toml'])
      },
    )

    test.for([
      {fixtureName: 'linked-endpoint-webhooks', diagnostic: '[webhooks.subscriptions.0.uri]: Required'},
      {
        fixtureName: 'linked-mixed-privacy',
        diagnostic:
          "[webhooks]: The privacy_compliance section can't be used if there are subscriptions including compliance_topics",
      },
    ])(
      'rejects incompatible linked input $fixtureName without rewriting it',
      async ({fixtureName, diagnostic}, {fixture}) => {
        // GIVEN
        await fixture.reserve(fixtureName)
        fixture.remote.specifications.push(
          ...['webhooks', 'webhook_subscription', 'privacy_compliance_webhooks'].map((id) => specification(id)),
        )
        // WHEN
        const argv = ['app', 'info', '--json']
        // THEN
        const result = await fixture.runShopifyCommand(argv)
        expect(result.exitCode).toBe(1)
        expect(result.stdout).toBe('')
        // Line wrapping is incidental; the filename and complete diagnostic are not.
        expect(text(normalizeText(result.stderr, fixture, ['shopify.app.toml']))).toBe(
          `Validation errors in <sandbox>/project/shopify.app.toml: ${diagnostic}`,
        )
        expect(result.after['shopify.app.toml']).toBe(result.before['shopify.app.toml'])
      },
    )
  })

  describe('additional file and source boundaries', () => {
    test('a dotenv directory is not loaded as an environment file', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('dotenv-directory')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).not.toHaveProperty('dotenv')
    })

    test('symlinked hidden configuration reads and writes only its fixture-local target', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('hidden-symlink')
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(text(result.stderr)).toContain('Dev store symlink.myshopify.com')
      expect(JSON.parse(await fixture.readFile('hidden-target.json'))[clientId]).toEqual({
        dev_store_url: 'symlink.myshopify.com',
      })
      expect(result.after['.shopify/project.json']).toBe('symlink:../hidden-target.json')
    })

    test('existing type output that is a directory causes a thrown write/read failure', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-output-directory')
      mockUiSpecification(fixture)
      mockErrorReport(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(result.exitCode).toBe(1)
      expect(text(result.stderr)).toContain('EISDIR')
      expect((await stat(fixture.path('extensions/ui/shopify.d.ts'))).isDirectory()).toBe(true)
      expect(operations(result).filter(Boolean)).toEqual(linkedOperations)
      expect(result.requests.filter((request) => request.url === errorReportingUrl)).toHaveLength(1)
      expect(changedPaths(result.rootBefore, result.rootAfter)).toEqual(
        [storeRelativePath(fixture, 'cli-kit'), 'project/.shopify/.gitignore', 'project/.shopify/project.json'].sort(),
      )
      expect(result.after['extensions/ui/shopify.extension.toml']).toBe(
        result.before['extensions/ui/shopify.extension.toml'],
      )
    })

    test('only an ancestor tsconfig skips UI type generation', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-ancestor-tsconfig')
      mockUiSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.after).not.toHaveProperty('extensions/ui/shopify.d.ts')
    })

    test('imported source contributes declarations without another main module', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-imported-source')
      mockUiSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      await expect(fixture.readFile('extensions/ui/shopify.d.ts')).resolves.toContain('./src/helper')
    })

    test('UID insertion is skipped when another component has collected errors', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-errors-no-uid')
      mockUiSpecification(fixture)
      const configuration = (await fixture.readFile('extensions/ui/shopify.extension.toml')).replace(/^uid = .*\n/m, '')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(2)
      await expect(fixture.readFile('extensions/ui/shopify.extension.toml')).resolves.toBe(configuration)
      expect(result.after).toHaveProperty('extensions/ui/shopify.d.ts')
    })

    test.for([
      {fixtureName: 'template-name-only', contents: 'name = "Legacy seed"\n'},
      {fixtureName: 'template-root-scopes', contents: 'scopes = "read_products"\n'},
      {fixtureName: 'template-hybrid-client-id', contents: 'client_id = ""\nscopes = "read_products"\n'},
      {fixtureName: 'template-current', contents: 'client_id = ""\n[access_scopes]\nscopes = "read_products"\n'},
    ])(
      'historical template $fixtureName enters linking rather than being reported as a linked app',
      async ({fixtureName, contents}, {fixture}) => {
        // GIVEN
        await fixture.reserve(fixtureName)
        // WHEN
        const flags = ['--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode).not.toBe(0)
        expect(result.requests).toEqual([])
        expect(text(result.stderr)).toContain('app config link')
        await expect(fixture.readFile('shopify.app.toml')).resolves.toBe(contents)
      },
    )

    test('unsupported extension directories do not trigger build/deploy locale reads', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('localized-module-wrong-locale-location')
      mockLocalizedSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
    })
  })

  describe('additional extension and mode contracts', () => {
    test.for([
      {fixtureName: 'theme-extension', type: 'theme'},
      {fixtureName: 'function-extension', type: 'function'},
      {fixtureName: 'flow-action-extension', type: 'flow_action'},
    ])('reports $type without performing deploy-only work', async ({fixtureName, type}, {fixture}) => {
      // GIVEN
      await fixture.reserve(fixtureName)
      fixture.remote.specifications.push(specification(type, 'extension'))
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout).allExtensions).toHaveLength(1)
      expect(result.events.filter((event) => event.type === 'spawn')).toEqual([])
    })

    test.for([[], ['--json'], ['--web-env'], ['--web-env', '--json']])(
      'collected web errors retain output then exit 2 in mode %j',
      async (flags, {fixture}) => {
        // GIVEN
        await fixture.reserve('empty-web-config')
        // WHEN
        const argv = flags
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...argv])
        expect(result.exitCode).toBe(2)
        if (flags.includes('--web-env')) {
          expect(result.stderr).toBe('')
          if (flags.includes('--json')) {
            expect(JSON.parse(result.stdout)).toEqual({
              SHOPIFY_API_KEY: clientId,
              SHOPIFY_API_SECRET: 'synthetic-app-secret',
              SCOPES: 'read_products',
            })
          } else {
            expect(result.stdout).toBe(
              `\n    SHOPIFY_API_KEY=${clientId}\n    SHOPIFY_API_SECRET=synthetic-app-secret\n    SCOPES=read_products\n  \n`,
            )
          }
        } else if (flags.includes('--json')) {
          const report = JSON.parse(result.stdout)
          expect(report.configuration.client_id).toBe(clientId)
          expect(report.webs).toEqual([])
          expect(JSON.stringify(report.errors)).toContain('commands')
          expect(result.stderr).toBe('')
        } else {
          expect(result.stdout).toBe('')
          expect(text(result.stderr)).toContain('CURRENT APP CONFIGURATION')
          expect(text(result.stderr)).toContain('App name Remote fixture')
          expect(text(result.stderr)).toContain('DIRECTORY COMPONENTS')
          expect(text(result.stderr)).toContain('TOOLING AND SYSTEM')
          expect(result.stderr).not.toContain('Fixture web')
        }
        expect(operations(result)).toEqual(linkedOperations)
      },
    )

    test.for([[], ['--json'], ['--web-env'], ['--web-env', '--json']])(
      'thrown generation failure prevents the report in mode %j',
      async (flags, {fixture}) => {
        // GIVEN
        await fixture.reserve('ui-no-installed-package')
        mockUiSpecification(fixture)
        // WHEN
        const argv = flags
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...argv])
        expect(result.exitCode).not.toBe(0)
        expect(result.stdout).toBe('')
        expect(result.stderr).not.toContain('CURRENT APP CONFIGURATION')
        expect(text(result.stderr)).toContain(
          'Type reference for admin.product-details.action.render could not be found',
        )
        expect(result.after).not.toHaveProperty('extensions/ui/shopify.d.ts')
      },
    )
  })

  describe('notifications, versions, and controlled subprocesses', () => {
    test.for(['info', 'warning', 'error'])(
      'cached %s notification is displayed and obeys its exit boundary',
      async (type, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        const store = await fixture.readStore('cli-kit')
        await fixture.seedState({
          caches: {
            ...(store.cache as object),
            'notifications-https://cdn.shopify.com/static/cli/notifications.json': {
              value: JSON.stringify({
                notifications: [
                  {
                    id: 'fixture-notice',
                    title: 'Fixture notice',
                    message: 'Fixture notification body',
                    type,
                    frequency: 'once',
                    ownerChannel: 'fixture',
                  },
                ],
              }),
              timestamp: now,
            },
          },
        })
        // WHEN
        const terminal = {replies: []}
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
        expect(result.exitCode === 0).toBe(type !== 'error')
        expect(text(result.terminalOutput)).toContain('Fixture notification body')
        expect(text(result.terminalOutput).includes('CURRENT APP CONFIGURATION')).toBe(type !== 'error')
      },
    )

    test.for([
      {value: 'true', shown: false},
      {value: 'y', shown: true},
    ])('early notification JSON reader differs for $value', async ({value, shown}, {fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({
        environment: {
          SHOPIFY_FLAG_JSON: value,
        },
      })
      const store = await fixture.readStore('cli-kit')
      await fixture.seedState({
        caches: {
          ...(store.cache as object),
          'notifications-https://cdn.shopify.com/static/cli/notifications.json': {
            value: JSON.stringify({
              notifications: [
                {
                  id: 'fixture-notice',
                  message: 'Fixture notification body',
                  type: 'info',
                  frequency: 'always',
                  ownerChannel: 'fixture',
                },
              ],
            }),
            timestamp: now,
          },
        },
      })
      // WHEN
      const terminal = {replies: []}
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info'], {terminal})
      expect(result.exitCode).toBe(0)
      expect(result.terminalOutput.includes('Fixture notification body')).toBe(shown)
    })

    test('duplicate CLI installations warn using a scripted version probe', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('local-cli-dependency')
      fixture.mockSubprocess({command: 'npm', args: ['list', '@shopify/cli'], stdout: '@shopify/cli@4.0.0\n'})
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      expect(result.events.filter((event) => event.type === 'spawn')).toHaveLength(1)
      expect(result.stderr).toContain('4.0.0')
    })

    test.for([false, true])(
      'forced upgrade uses scripted installation and version verification (failure=%s)',
      async (failure, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        fixture.configure({
          environment: {
            SHOPIFY_CLI_FORCE_AUTO_UPGRADE: '1',
          },
        })
        const store = await fixture.readStore('cli-kit')
        await fixture.seedState({
          caches: {...(store.cache as object), 'npm-package-@shopify/cli': {value: '4.999.0', timestamp: now}},
        })
        fixture.mockNetwork({
          method: 'GET',
          url: 'https://cdn.shopify.com/static/cli/notifications.json',
          responses: [{body: {notifications: []}}],
        })
        fixture.mockSubprocess({
          command: 'npm',
          args: ['install', '-g', '@shopify/cli@latest'],
          exitCode: failure ? 1 : 0,
        })
        if (!failure)
          fixture.mockSubprocess({
            command: 'shopify',
            args: [],
            stdout: '@shopify/cli/4.999.0 darwin-arm64 node-v22.0.0\n',
          })
        // WHEN
        const flags: string[] = []
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode, result.stderr).toBe(0)
        expect(text(result.stderr)).toContain('CURRENT APP CONFIGURATION')
        expect(
          result.events.some((event) => event.type === 'spawn' && event.args?.includes('@shopify/cli@latest')),
        ).toBe(true)
        expect(result.stderr.includes('Shopify CLI upgraded')).toBe(!failure)
        if (failure) expect(text(result.stderr)).toContain('Version 4.999.0 available! Run')
        expect(result.requests.some((request) => request.url === errorReportingUrl)).toBe(false)
      },
    )

    test('fresh blocking auto-upgrade notification prevents the install subprocess', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({
        environment: {
          SHOPIFY_CLI_FORCE_AUTO_UPGRADE: '1',
        },
      })
      await fixture.seedState({
        caches: {'npm-package-@shopify/cli': {value: '4.999.0', timestamp: now}},
      })
      fixture.mockNetwork({
        method: 'GET',
        url: 'https://cdn.shopify.com/static/cli/notifications.json',
        responses: [
          {
            body: {
              notifications: [
                {
                  id: 'upgrade-block',
                  message: 'Do not upgrade',
                  type: 'error',
                  surface: 'autoupgrade',
                  frequency: 'always',
                  ownerChannel: 'fixture',
                },
              ],
            },
          },
        ],
      })
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.events.filter((event) => event.type === 'spawn')).toEqual([])
    })
  })

  describe('report contracts', () => {
    test.for([
      {fixtureName: 'report-components', exitCode: 0, extensionDetails: 'metafields 2'},
      {
        fixtureName: 'ui-missing-source',
        exitCode: 2,
        extensionDetails: `error ! Couldn't find extensions/ui/src/index.ts
Please check the module path for admin.product-details.action.render

Please check the configuration in
<sandbox>/project/extensions/ui/shopify.extension.toml`,
      },
    ])(
      'renders the complete text report for $fixtureName',
      async ({fixtureName, exitCode, extensionDetails}, {fixture}) => {
        // GIVEN
        await fixture.reserve(fixtureName)
        mockUiSpecification(fixture)
        // WHEN
        const argv = ['app', 'info', '--no-color']
        // THEN
        const result = await fixture.runShopifyCommand(argv)
        expect(result.exitCode, result.stderr).toBe(exitCode)
        expect(result.stdout).toBe('')
        expect(result.stderr).toBe(stripVTControlCharacters(result.stderr))
        expect(normalizeText(result.stderr, fixture, ['extensions/ui/shopify.extension.toml'])).toBe(
          `CURRENT APP CONFIGURATION

Configuration file shopify.app.toml
App name Remote fixture
Client ID ${clientId}
Organization Fixture organization (123)
Access scopes read_products
Dev store Not yet configured
Update URLs Not yet configured
User fixture@example.test

💡 To change these, run \`shopify app config link\`

YOUR PROJECT

Root location <sandbox>/project

DIRECTORY COMPONENTS

web
📂 web
📂 Fixture web web
roles frontend, backend

ui_extension
📂 fixture-ui extensions/ui
config file shopify.extension.toml
${extensionDetails}

TOOLING AND SYSTEM

Shopify CLI 4.8.0
Package manager pnpm
OS <platform-arch>
Shell /bin/bash
Node version <node-version>`,
        )
      },
    )

    test('reports extension identity, configuration and paths without runtime schemas', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('report-components')
      mockUiSpecification(fixture)
      // WHEN
      const argv = ['app', 'info', '--json']
      // THEN
      const result = await fixture.runShopifyCommand(argv)
      expect(result.exitCode, result.stderr).toBe(0)
      expect(result.stderr).toBe('')
      const report = JSON.parse(result.stdout)
      expect(report).not.toHaveProperty('configSchema')
      for (const specification of report.specifications) expect(specification).not.toHaveProperty('schema')
      for (const extension of [...report.allExtensions, ...report.realExtensions]) {
        expect(extension.specification).not.toHaveProperty('schema')
      }
      expect(report.allExtensions).toHaveLength(1)
      const [extension] = report.allExtensions
      const targeting = [{target: 'admin.product-details.action.render', module: './src/index.ts'}]
      const metafields = [
        {namespace: 'fixture', key: 'first'},
        {namespace: 'fixture', key: 'second'},
      ]
      expect(extension).toMatchObject({
        handle: 'fixture-ui',
        uid: '11111111-1111-1111-1111-111111111111',
        directory: fixture.path('extensions/ui'),
        configurationPath: fixture.path('extensions/ui/shopify.extension.toml'),
        specification: {identifier: 'ui_extension', experience: 'extension'},
      })
      expect(extension.configuration).toMatchObject({
        name: 'Fixture UI',
        type: 'ui_extension',
        handle: 'fixture-ui',
        uid: '11111111-1111-1111-1111-111111111111',
        api_version: '2025-10',
      })
      expect(extension.configuration.targeting).toEqual(targeting)
      expect(extension.configuration.metafields).toEqual(metafields)
      // Compare reported target data, not duplicated deploy-step/asset metadata.
      expect(extension.configuration.extension_points).toMatchObject([{...targeting[0], metafields}])
      expect(report.errors).toEqual({errors: []})
    })

    test('reports a missing project before authentication or project writes', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('no-project')
      const kitBefore = await fixture.readStore('cli-kit')
      // WHEN
      const argv = ['app', 'info', '--json']
      // THEN
      const result = await fixture.runShopifyCommand(argv)
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
      expect(text(result.stderr)).toContain('Could not find a Shopify app configuration file')
      expect(result.stderr).toContain(fixture.projectPath)
      expect(result.requests).toEqual([])
      expect(result.after).toEqual(result.before)
      expect(changedPaths(result.rootBefore, result.rootAfter)).toEqual([storeRelativePath(fixture, 'cli-kit')])
      await expect(fixture.readStore('cli-kit')).resolves.toMatchObject(kitBefore)
    })
  })

  describe('environment-only flag bindings', () => {
    test('selects a named config from the environment without argv or a saved preference', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('named-config-dotenv')
      fixture.configure({environment: {SHOPIFY_FLAG_APP_CONFIG: 'staging'}})
      // WHEN
      const argv = ['app', 'info', '--json']
      // THEN
      const result = await fixture.runShopifyCommand(argv)
      expect(result.exitCode, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        configuration: {name: 'Staging fixture'},
        dotenv: {variables: {SHARED: 'staging'}},
      })
      expect(result.stdout).not.toContain('DEFAULT_ONLY')
      expect(result.stderr).toBe('')
    })

    test('selects the project from the path environment variable', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({cwd: fixture.root, environment: {SHOPIFY_FLAG_PATH: fixture.projectPath}})
      // WHEN
      const argv = ['app', 'info', '--json']
      // THEN
      const result = await fixture.runShopifyCommand(argv)
      expect(result.exitCode, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout).directory).toBe(fixture.projectPath)
      expect(result.stderr).toBe('')
    })

    test('overrides the client ID from the environment without rewriting the TOML', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({environment: {SHOPIFY_FLAG_CLIENT_ID: 'environment-client'}})
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        variables: {apiKey: 'environment-client'},
        responses: [{body: {data: {app: {...fixture.remote.app, key: 'environment-client'}}}}],
      })
      // WHEN
      const argv = ['app', 'info', '--json']
      // THEN
      const result = await fixture.runShopifyCommand(argv)
      expect(result.exitCode, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout).configuration.client_id).toBe('environment-client')
      expect(result.after['shopify.app.toml']).toBe(result.before['shopify.app.toml'])
      expect(result.stderr).toBe('')
    })

    test('an environment alias overrides another saved account for this invocation only', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      const other = structuredClone(fixture.user)
      other.identity.userId = 'other'
      other.identity.alias = 'other'
      other.applications[businessAudience].accessToken = 'other-account-token'
      await fixture.seedState({
        authentication: {
          currentSessionId: 'other',
          sessions: {'accounts.shopify.com': {'synthetic-user': fixture.user, other}},
        },
      })
      fixture.configure({environment: {SHOPIFY_FLAG_AUTH_ALIAS: 'fixture'}})
      // WHEN
      const argv = ['app', 'info']
      // THEN
      const result = await fixture.runShopifyCommand(argv)
      expect(result.exitCode, result.stderr).toBe(0)
      expect(text(result.stderr)).toContain('User fixture@example.test')
      expect(result.requests[0]!.headers?.authorization).toBe('Bearer synthetic-business-token')
      expect((await fixture.readStore('cli-kit')).currentSessionId).toBe('other')
    })

    test('selects web-env output from the environment', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({environment: {SHOPIFY_FLAG_OUTPUT_WEB_ENV: '1'}})
      // WHEN
      const argv = ['app', 'info', '--json']
      // THEN
      const result = await fixture.runShopifyCommand(argv)
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(JSON.parse(result.stdout)).toEqual({
        SHOPIFY_API_KEY: clientId,
        SHOPIFY_API_SECRET: 'synthetic-app-secret',
        SCOPES: 'read_products',
      })
    })

    test.for(['argv', 'environment'])('no-color overrides forced color via %s', async (source, {fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({environment: {FORCE_COLOR: '1'}})
      const colored = await fixture.runShopifyCommand(['app', 'info'], {terminal: {replies: []}})
      if (source === 'environment') fixture.configure({environment: {SHOPIFY_FLAG_NO_COLOR: '1'}})
      // WHEN
      const argv = ['app', 'info', ...(source === 'argv' ? ['--no-color'] : [])]
      // THEN
      const result = await fixture.runShopifyCommand(argv, {terminal: {replies: []}})
      expect(result.exitCode).toBe(0)
      const sgr = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`)
      expect(colored.terminalOutput).toMatch(sgr)
      expect(result.terminalOutput).not.toMatch(sgr)
      expect(normalizeText(result.terminalOutput, fixture)).toBe(normalizeText(colored.terminalOutput, fixture))
    })
  })

  describe('result modes and parsing', () => {
    test.for(['--json', '-j'])('returns loaded local data on stdout with %s', async (flag, {fixture}) => {
      // GIVEN
      await fixture.reserve('dotenv-secret')
      // WHEN
      const flags = [flag]
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      const report = JSON.parse(result.stdout)
      expect(report).toMatchObject({
        name: 'Local fixture',
        directory: fixture.projectPath,
        configPath: fixture.path('shopify.app.toml'),
        packageManager: 'pnpm',
        usesWorkspaces: false,
      })
      expect(report.configuration).toEqual({
        client_id: clientId,
        name: 'Local fixture',
        application_url: 'https://fixture.example.test',
        embedded: true,
        access_scopes: {scopes: 'read_products'},
        auth: {redirect_urls: ['https://fixture.example.test/auth/callback']},
      })
      expect(report.webs).toEqual([
        {
          directory: fixture.path('web'),
          configuration: {name: 'Fixture web', roles: ['frontend', 'backend'], commands: {dev: 'node server.js'}},
          framework: 'unknown',
        },
      ])
      expect(report.dotenv).toEqual({path: fixture.path('.env'), variables: {SYNTHETIC_SECRET: 'fixture-secret'}})
      expect(report.organization).toEqual({id: '123', businessName: 'Fixture organization'})
      expect(report.nodeDependencies).toEqual({})
      expect(report.allExtensions).toEqual([])
      expect(report.errors).toEqual({errors: []})
      expect(report).not.toHaveProperty('configSchema')
      expect(result.stdout).not.toContain('synthetic-app-secret')
      expect(operations(result)).toEqual(linkedOperations)
    })

    test.for([false, true])('reports web environment (json=%s)', async (json, {fixture}) => {
      // GIVEN
      await fixture.reserve('dotenv-web-secret')
      // WHEN
      const flags = ['--web-env', ...(json ? ['--json'] : [])]
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      if (json)
        expect(JSON.parse(result.stdout)).toEqual({
          SHOPIFY_API_KEY: clientId,
          SHOPIFY_API_SECRET: 'synthetic-app-secret',
          SCOPES: 'read_products',
        })
      else {
        expect(result.stdout).toBe(
          `\n    SHOPIFY_API_KEY=${clientId}\n    SHOPIFY_API_SECRET=synthetic-app-secret\n    SCOPES=read_products\n  \n`,
        )
      }
      expect(result.stdout).not.toContain('not-the-remote-secret')
      expect(operations(result)).toEqual(linkedOperations)
    })

    test.for([false, true])('handles an app with no secrets (json=%s)', async (json, {fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [
          {
            body: {
              data: {
                app: {
                  ...fixture.remote.app,
                  activeRoot: {...fixture.remote.app.activeRoot, clientCredentials: {secrets: []}},
                },
              },
            },
          },
        ],
      })
      // WHEN
      const flags = ['--web-env', ...(json ? ['--json'] : [])]
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      if (json) expect(JSON.parse(result.stdout)).toEqual({SHOPIFY_API_KEY: clientId, SCOPES: 'read_products'})
      else
        expect(result.stdout).toBe(
          `\n    SHOPIFY_API_KEY=${clientId}\n    SHOPIFY_API_SECRET=\n    SCOPES=read_products\n  \n`,
        )
    })

    test('uses only the first rotated secret', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.remote.app.activeRoot.clientCredentials.secrets.push({key: 'second-secret'})
      // WHEN
      const flags = ['--web-env', '--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(JSON.parse(result.stdout)).toEqual({
        SHOPIFY_API_KEY: clientId,
        SHOPIFY_API_SECRET: 'synthetic-app-secret',
        SCOPES: 'read_products',
      })
      expect(result.stdout).not.toContain('second-secret')
    })

    test('help does not authenticate or load malformed project files', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('invalid-configs-help')
      // WHEN
      const flags = ['--help']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.stdout + result.stderr).toContain('--web-env')
      expect(result.requests).toEqual([])
      expect(result.after).toEqual(result.before)
    })

    test.for([
      {flags: ['--environment', 'production'], message: /Nonexistent flag.*--environment/},
      {flags: ['--json=false'], message: /Unexpected argument.*false/},
      {flags: ['--json', 'false'], message: /Unexpected argument.*false/},
      {flags: ['--no-json'], message: /Nonexistent flag.*--no-json/},
      {flags: ['--config', 'one', '--config', 'two'], message: /--config.*specified.*once/},
      {flags: ['--config', 'staging', '--reset'], message: /--config.*--reset|--reset.*--config/},
      {flags: ['--config', 'staging', '--client-id', 'other'], message: /--config.*--client-id|--client-id.*--config/},
      {flags: ['--unknown'], message: /Nonexistent flag.*--unknown/},
      {flags: ['unexpected-argument'], message: /command .*unexpected-argument.*not found/i},
    ])('rejects invalid argv $flags before API work', async ({flags, message}, {fixture}) => {
      // GIVEN
      await fixture.reserve('dotenv-unused-during-parse-failure')
      // WHEN
      const argv = flags
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...argv])
      expect(result.exitCode).toBe(flags[0] === 'unexpected-argument' ? 1 : 2)
      expect(text(result.stderr)).toMatch(message)
      expect(result.requests).toEqual([])
      expect(result.stdout).toBe('')
      // Unknown subcommands stop earlier than app-info's parser/metadata hooks.
      const expectedChanges =
        flags[0] === 'unexpected-argument'
          ? []
          : [
              storeRelativePath(fixture, 'cli-kit'),
              'project/.shopify/.gitignore',
              'project/.shopify/project.json',
            ].sort()
      expect(changedPaths(result.rootBefore, result.rootAfter)).toEqual(expectedChanges)
      if (flags[0] !== 'unexpected-argument')
        expect(JSON.parse(await fixture.readFile('.shopify/project.json'))).toEqual({})
    })

    test.for(['1', 'true', 'TRUE', 'yes', 'y'])('reads JSON flag binding %s', async (value, {fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({
        environment: {
          SHOPIFY_FLAG_JSON: value,
        },
      })
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).configuration.client_id).toBe(clientId)
    })

    test('a false reset environment value still conflicts with explicit config', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({
        environment: {
          SHOPIFY_FLAG_RESET: 'false',
        },
      })
      // WHEN
      const flags = ['--config', 'staging']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.requests).toEqual([])
      expect(text(result.stderr)).toMatch(/reset.*config|config.*reset/)
    })

    test.for(['argv', 'environment'])(
      'verbose via %s logs requests without changing the JSON result',
      async (source, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        const ordinary = await fixture.runShopifyCommand(['app', 'info', '--json'])
        fixture.configure({
          environment: {
            DEBUG: '',
            SHOPIFY_FLAG_VERBOSE: source === 'environment' ? '1' : undefined,
          },
        })
        // WHEN
        const flags = ['--json', ...(source === 'argv' ? ['--verbose'] : [])]
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode).toBe(0)
        expect(result.stdout.startsWith('{'), result.stdout.slice(0, 800)).toBe(true)
        expect(JSON.parse(result.stdout).configuration.client_id).toBe(clientId)
        expect(JSON.parse(result.stdout)).toEqual(JSON.parse(ordinary.stdout))
        expect(result.stderr).toContain('Running command app info')
        expect(result.stderr).toContain('ActiveAppReleaseFromApiKey')
        expect(operations(result)).toEqual(['ActiveAppReleaseFromApiKey', 'fetchSpecifications'])
      },
    )
  })

  describe('configuration selection and stored preference', () => {
    test('saved configuration selects named TOML and dotenv without merging defaults', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('named-config-dotenv')
      await fixture.seedState({
        appPreferences: {configFile: 'shopify.app.staging.toml', title: 'Stale title', orgId: '999'},
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        configuration: {name: 'Staging fixture'},
        dotenv: {variables: {SHARED: 'staging'}},
      })
      expect(JSON.parse(result.stdout).dotenv.variables).not.toHaveProperty('DEFAULT_ONLY')
      const store = await fixture.readStore('app')
      expect(store[fixture.projectPath]).toMatchObject({
        configFile: 'shopify.app.staging.toml',
        title: 'Remote fixture',
        orgId: '123',
      })
    })

    test.for(['--config', '-c'])(
      'explicit %s overrides but does not persist a saved selection',
      async (flag, {fixture}) => {
        // GIVEN
        await fixture.reserve('named-staging-fixture')
        fixture.configure({
          environment: {
            SHOPIFY_FLAG_APP_CONFIG: 'missing',
          },
        })
        await fixture.seedState({
          appPreferences: {configFile: 'shopify.app.toml'},
        })
        // WHEN
        const flags = [flag, 'staging', '--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode).toBe(0)
        expect(JSON.parse(result.stdout).configuration.name).toBe('Staging fixture')
        expect((await fixture.readStore('app'))[fixture.projectPath]).toMatchObject({configFile: 'shopify.app.toml'})
      },
    )

    test('client-ID override changes the request without choosing another TOML', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('client-id-override')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        variables: {apiKey: 'overridden-client-id'},
        responses: [{body: {data: {app: {...fixture.remote.app, key: 'overridden-client-id'}}}}],
      })
      // WHEN
      const flags = ['--client-id', 'overridden-client-id', '--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).configuration).toMatchObject({
        name: 'Local fixture',
        client_id: 'overridden-client-id',
      })
      await expect(fixture.readFile('shopify.app.toml')).resolves.toContain(`client_id = "${clientId}"`)
    })

    test('recovers a stale preference when exactly one configuration remains', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await fixture.seedState({
        appPreferences: {configFile: 'shopify.app.deleted.toml'},
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toContain('shopify.app.deleted.toml')
      expect((await fixture.readStore('app'))[fixture.projectPath]).toMatchObject({configFile: 'shopify.app.toml'})
    })

    test('does not invent a default when only a named config exists', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('named-config-only')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(result.requests).toEqual([])
    })

    test.for(['--path', 'INIT_CWD'])('selects the project through %s', async (source, {fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      if (source === 'INIT_CWD')
        fixture.configure({
          environment: {
            INIT_CWD: fixture.projectPath,
          },
        })
      // WHEN
      const flags = source === '--path' ? ['--path', fixture.projectPath, '--json'] : ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags], {cwd: fixture.root})
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).directory).toBe(fixture.projectPath)
    })

    test.for([
      {fixtureName: 'invalid-app-toml-syntax', message: /Unterminated inline array/},
      {fixtureName: 'invalid-app-client-id-type', message: /app config link.*requires additional flags/},
    ])('rejects invalid app TOML $fixtureName before remote loading', async ({fixtureName, message}, {fixture}) => {
      // GIVEN
      await fixture.reserve(fixtureName)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(result.requests).toEqual([])
      expect(result.exitCode).toBe(1)
      expect(text(result.stderr)).toMatch(message)
      expect(result.after).toEqual(result.before)
    })
  })

  describe('local files and package metadata', () => {
    test('dotenv parsing retains empty values, last duplicates, and unexpanded variables', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('dotenv-parsing')
      // eslint-disable-next-line no-template-curly-in-string -- Deliberately unexpanded dotenv data.
      const reference = '${DUP}'
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).dotenv.variables).toEqual({DUP: 'last', EMPTY: '', REFERENCE: reference})
    })

    test('a named configuration without dotenv does not fall back to .env', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('named-config-no-dotenv')
      // WHEN
      const flags = ['--config', 'staging', '--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).not.toContain('NOT_SELECTED')
    })

    test('nearest empty environments file shadows a malformed ancestor', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('environments-shadowing')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(operations(result)).toEqual(linkedOperations)
    })

    test('malformed nearest environments file fails before API calls', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('environments-invalid')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.requests).toEqual([])
      expect(result.stdout).toBe('')
    })

    test('migrates a legacy hidden dev store while preserving unrelated data and ignore bytes', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('hidden-legacy')
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(text(result.stderr)).toContain('Dev store legacy.myshopify.com')
      expect(JSON.parse(await fixture.readFile('.shopify/project.json'))).toEqual({
        dev_store_url: 'legacy.myshopify.com',
        unrelated: true,
        [clientId]: {dev_store_url: 'legacy.myshopify.com'},
      })
      await expect(fixture.readFile('.shopify/.gitignore')).resolves.toBe('preserve-this\n')
    })

    test('an empty matching hidden entry suppresses legacy migration', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('hidden-empty-matching-entry')
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(text(result.stderr)).toContain('Dev store Not yet configured')
      expect(result.stderr).not.toContain('legacy.myshopify.com')
    })

    test('malformed hidden JSON is ignored without repairing its bytes', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('hidden-invalid-json')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)._hiddenConfig).toEqual({})
      await expect(fixture.readFile('.shopify/project.json')).resolves.toBe('{bad')
    })

    test.for([
      {fixtureName: 'package-manager-yarn', marker: 'yarn.lock', manager: 'yarn'},
      {fixtureName: 'package-manager-pnpm', marker: 'pnpm-lock.yaml', manager: 'pnpm'},
      {fixtureName: 'package-manager-bun', marker: 'bun.lock', manager: 'bun'},
      {fixtureName: 'package-manager-npm', marker: 'package-lock.json', manager: 'npm'},
    ])('detects $manager from $marker without running it', async ({fixtureName, marker, manager}, {fixture}) => {
      // GIVEN
      await fixture.reserve(fixtureName)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).packageManager).toBe(manager)
      expect(result.events.filter((event) => event.type === 'spawn')).toEqual([])
    })

    test('manifest absence skips marker detection', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('missing-manifest')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        packageManager: 'unknown',
        nodeDependencies: {},
        usesWorkspaces: false,
      })
    })

    test('devDependencies override dependencies; an empty workspace array is truthy', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('manifest-dependencies-workspaces')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({nodeDependencies: {example: '2'}, usesWorkspaces: true})
      expect(JSON.parse(result.stdout).nodeDependencies).not.toHaveProperty('peer')
    })

    test.for([
      {fixtureName: 'manifest-invalid-json', contents: '{bad', message: /JSON.*position|property name/},
      {fixtureName: 'manifest-null', contents: 'null', message: /null.*dependencies/},
      {fixtureName: 'manifest-bom', contents: '\ufeff{}', message: /Unexpected token/},
    ])('malformed manifest $fixtureName aborts', async ({fixtureName, contents, message}, {fixture}) => {
      // GIVEN
      await fixture.reserve(fixtureName)
      if (contents === 'null')
        fixture.mockNetwork({
          method: 'POST',
          url: 'https://error-analytics-production.shopifysvc.com/',
          responses: [{status: 200, body: {}}],
        })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(result.exitCode).toBe(1)
      expect(text(result.stderr)).toMatch(message)
      expect(result.after).toEqual(result.before)
    })

    test('no web files is a valid project', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('no-web')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).webs).toEqual([])
    })

    test('legacy web type normalizes to roles without executing commands', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('legacy-web-type')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).webs[0].configuration.roles).toEqual(['backend'])
      expect(result.events.filter((event) => event.type === 'spawn')).toEqual([])
    })

    test.for([{fixtureName: 'web-missing-command'}, {fixtureName: 'web-invalid-command'}])(
      'invalid web contents $fixtureName yield a report then exit 2',
      async ({fixtureName}, {fixture}) => {
        // GIVEN
        await fixture.reserve(fixtureName)
        // WHEN
        const flags = ['--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode).toBe(2)
        expect(JSON.parse(result.stdout).webs).toEqual([])
        expect(operations(result)).toEqual(linkedOperations)
      },
    )

    test('duplicate web roles across files are collected errors', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('duplicate-web-roles')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(2)
      expect(JSON.parse(result.stdout).webs).toHaveLength(2)
    })
  })

  describe('authentication and remote data', () => {
    test('known account alias reuses credentials and preserves the saved account', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      const before = await fixture.readStore('cli-kit')
      // WHEN
      const flags = ['--auth-alias', 'fixture']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(text(result.stderr)).toContain('User fixture@example.test')
      expect(operations(result)).toEqual(linkedOperations)
      expect((await fixture.readStore('cli-kit')).sessionStore).toBe(before.sessionStore)
      expect((await fixture.readStore('cli-kit')).currentSessionId).toBe('synthetic-user')
    })

    test('unknown alias fails even with an automation token', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({
        environment: {
          SHOPIFY_APP_AUTOMATION_TOKEN: 'synthetic-automation-token',
        },
      })
      // WHEN
      const flags = ['--auth-alias', 'missing']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(text(result.stderr)).toContain('No authenticated account found for alias missing')
      expect(result.requests).toEqual([])
    })

    test('invalid serialized sessions are removed before alias lookup fails', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await fixture.seedState({
        authentication: {
          serializedSessions: '{invalid',
        },
      })
      // WHEN
      const flags = ['--auth-alias', 'fixture']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      const store = await fixture.readStore('cli-kit')
      expect(store).not.toHaveProperty('sessionStore')
      expect(store).not.toHaveProperty('currentSessionId')
      expect(store.autoUpgradeEnabled).toBe(false)
      expect(result.requests).toEqual([])
    })

    test('successful account response with no user renders unknown, not an authentication retry', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'UserInfo',
        responses: [{body: {data: {currentUserAccount: null}}}],
      })
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(text(result.stderr)).toContain('User unknown')
      expect(operations(result)).toEqual(linkedOperations)
    })

    test('missing remote app fails before organization/specification requests', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [{body: {data: {app: null}}}],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(text(result.stderr)).toContain(`No app with client ID \`${clientId}\` found`)
      expect(operations(result)).toEqual(linkedOperations.slice(0, 2))
    })

    test('missing organization fails without a fallback organization', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'FindOrganization',
        responses: [{body: {data: {currentUserAccount: {organization: null}}}}],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(operations(result)).toEqual(linkedOperations.slice(0, 3))
    })

    test.for([403, 500])('HTTP %s fails without a generic status retry', async (status, {fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [{status, body: {errors: [{message: 'Fixture API failure'}]}}],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(operations(result)).toEqual(linkedOperations.slice(0, 2))
    })

    test('GraphQL errors reject partial data even with HTTP 200', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [
          {
            body: {data: {app: fixture.remote.app}, errors: [{message: 'Fixture GraphQL failure'}]},
          },
        ],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(text(result.stderr)).toContain('Fixture GraphQL failure')
    })

    test('throttling retries remain active with network-level retries disabled', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [
          {
            status: 429,
            headers: {'Retry-After': '0'},
            body: {errors: [{message: 'Throttled', extensions: {code: 'THROTTLED'}}]},
          },
          {body: {data: {app: fixture.remote.app}}},
        ],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(operations(result)).toEqual([
        'UserInfo',
        'ActiveAppReleaseFromApiKey',
        'ActiveAppReleaseFromApiKey',
        'FindOrganization',
        'fetchSpecifications',
      ])
    })

    test('throttling stops after ten retries rather than looping forever', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [
          ...Array.from({length: 11}, () => ({
            status: 429,
            headers: {'Retry-After': '0'},
            body: {errors: [{message: 'Throttled', extensions: {code: 'THROTTLED'}}]},
          })),
        ],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(operations(result).filter((operation) => operation === 'ActiveAppReleaseFromApiKey')).toHaveLength(11)
      expect(operations(result)).not.toContain('FindOrganization')
    })

    test('a second process renders cached identity and organization alongside fresh app data', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await fixture.runShopifyCommand(['app', 'info', '--json'])
      const freshApp = structuredClone(fixture.remote.app)
      freshApp.activeRelease.version.name = 'Updated remote app'
      fixture.mockNetwork({operation: 'ActiveAppReleaseFromApiKey', responses: [{body: {data: {app: freshApp}}}]})
      fixture.mockNetwork({
        operation: 'UserInfo',
        responses: [{status: 500, body: {errors: [{message: 'Must use cached user'}]}}],
      })
      fixture.mockNetwork({
        operation: 'FindOrganization',
        responses: [{status: 500, body: {errors: [{message: 'Must use cached organization'}]}}],
      })
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(operations(result)).toEqual(['ActiveAppReleaseFromApiKey', 'fetchSpecifications'])
      expect(result.stdout).toBe('')
      expect(text(result.stderr)).toContain('App name Updated remote app')
      expect(text(result.stderr)).toContain('User fixture@example.test')
      expect(text(result.stderr)).toContain('Organization Fixture organization (123)')
      expect((await fixture.readStore('app'))[fixture.projectPath]).toMatchObject({title: 'Updated remote app'})
    })

    test.for([
      {fixtureName: 'unlinked-named-template', reset: false},
      {fixtureName: 'linked-app', reset: true},
    ])(
      'noninteractive linking requires a client ID before requests (reset=$reset)',
      async ({fixtureName, reset}, {fixture}) => {
        // GIVEN
        await fixture.reserve(fixtureName)
        // WHEN
        const flags = reset ? ['--reset'] : []
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode).not.toBe(0)
        expect(result.stdout).toBe('')
        expect(text(result.stderr)).toContain('requires additional flags in non-interactive terminal environments')
        expect(result.requests).toEqual([])
      },
    )
  })

  describe('session refresh and specification failures', () => {
    test('refreshes an expired identity, exchanges four audiences, and saves the new session', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      const user = structuredClone(fixture.user)
      user.identity.expiresAt = '2000-01-01T00:00:00Z'
      await fixture.seedState({
        authentication: {
          sessions: {
            'accounts.shopify.com': {
              'synthetic-user': user,
            },
          },
        },
      })
      fixture.mockNetwork({
        method: 'POST',
        url: 'https://accounts.shopify.com/oauth/token',
        form: {grant_type: 'refresh_token'},
        responses: [
          {
            body: {
              access_token: 'synthetic-refreshed-identity',
              refresh_token: 'synthetic-refreshed-refresh',
              expires_in: 3600,
              scope: user.identity.scopes.join(' '),
            },
          },
        ],
      })
      fixture.mockTokenExchange(appAudience, 'proactively-refreshed-app-token')
      fixture.mockTokenExchange(businessAudience, 'proactively-refreshed-business-token')
      for (const request of fixture.networkMocks.filter((entry) => entry.operation)) {
        request.headers = {
          Authorization: `Bearer ${
            request.url === businessPlatformUrl
              ? 'proactively-refreshed-business-token'
              : 'proactively-refreshed-app-token'
          }`,
        }
      }
      fixture.mockTokenExchange('ee139b3d-5861-4d45-b387-1bc3ada7811c', 'synthetic-storefront-token')
      fixture.mockTokenExchange(
        '271e16d403dfa18082ffb3d197bd2b5f4479c3fc32736d69296829cbb28d41a6',
        'synthetic-partners-token',
      )
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      expect(result.requests).toHaveLength(9)
      expect(operations(result).filter(Boolean)).toEqual(linkedOperations)
      const store = await fixture.readStore('cli-kit')
      expect(JSON.parse(store.sessionStore as string)['accounts.shopify.com']['synthetic-user']).toMatchObject({
        identity: {accessToken: 'synthetic-refreshed-identity', refreshToken: 'synthetic-refreshed-refresh'},
        applications: {
          [appAudience]: {accessToken: 'proactively-refreshed-app-token'},
          [businessAudience]: {accessToken: 'proactively-refreshed-business-token'},
        },
      })
      const exchanges = result.requests.filter((request) => new URLSearchParams(request.body).has('audience'))
      expect(exchanges).toHaveLength(4)
      for (const exchange of exchanges)
        expect(new URLSearchParams(exchange.body).get('subject_token')).toBe('synthetic-refreshed-identity')
      expect(JSON.parse(result.stdout).configuration.client_id).toBe(clientId)
    })

    test('automation credentials exchange two tokens and report a service account instead of the stored user', async ({
      fixture,
    }) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({
        environment: {
          SHOPIFY_APP_AUTOMATION_TOKEN: 'synthetic-automation-token',
        },
      })
      fixture.mockTokenExchange(appAudience, 'synthetic-app-token')
      fixture.mockTokenExchange(businessAudience, 'synthetic-business-token')
      const before = await fixture.readStore('cli-kit')
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      expect(result.requests).toHaveLength(6)
      expect(text(result.stderr)).toContain('Service account Fixture organization')
      expect(new URLSearchParams(result.requests[0]!.body).get('subject_token')).toBe('synthetic-automation-token')
      expect((await fixture.readStore('cli-kit')).sessionStore).toBe(before.sessionStore)
    })

    test('expired identity attempts refresh; invalid_request clears the session and aborts', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      const user = structuredClone(fixture.user)
      user.identity.expiresAt = '2000-01-01T00:00:00Z'
      await fixture.seedState({
        authentication: {
          sessions: {
            'accounts.shopify.com': {
              'synthetic-user': user,
            },
          },
        },
      })
      fixture.mockNetwork({
        method: 'POST',
        url: 'https://accounts.shopify.com/oauth/token',
        responses: [{status: 400, body: {error: 'invalid_request', error_description: 'Fixture refresh rejection'}}],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(result.requests).toHaveLength(1)
      expect(new URLSearchParams(result.requests[0]!.body).get('grant_type')).toBe('refresh_token')
      await expect(fixture.readStore('cli-kit')).resolves.not.toHaveProperty('sessionStore')
    })

    test('missing identity scopes starts device authorization rather than reusing API tokens', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      const user = structuredClone(fixture.user)
      user.identity.scopes = ['openid']
      await fixture.seedState({
        authentication: {
          sessions: {
            'accounts.shopify.com': {
              'synthetic-user': user,
            },
          },
        },
      })
      fixture.mockNetwork({
        method: 'POST',
        url: 'https://accounts.shopify.com/oauth/device_authorization',
        responses: [{status: 400, body: {error: 'invalid_client'}}],
      })
      fixture.mockNetwork({
        method: 'POST',
        url: 'https://error-analytics-production.shopifysvc.com/',
        responses: [{body: {}}],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(result.requests.map((request) => request.url)).toEqual([
        'https://accounts.shopify.com/oauth/device_authorization',
        'https://error-analytics-production.shopifysvc.com/',
      ])
      expect(text(result.stderr)).toContain('Failed to start authorization process')
    })

    test('tokens exactly at the four-minute threshold are still reusable', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      const user = structuredClone(fixture.user)
      user.identity.expiresAt = new Date(now + 4 * 60 * 1000).toISOString()
      await fixture.seedState({
        authentication: {
          sessions: {
            'accounts.shopify.com': {
              'synthetic-user': user,
            },
          },
        },
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(operations(result)).toEqual(linkedOperations)
    })

    test('empty specification results do not fall back to local extension specifications', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-extension')
      mockUiSpecification(fixture)
      fixture.remote.specifications.splice(0)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout).allExtensions).toEqual([])
      expect(result.after).not.toHaveProperty('extensions/ui/shopify.d.ts')
    })

    test('a changed extension contract is fetched after cache warmup and appears in the report', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-extension')
      mockUiSpecification(fixture)
      await fixture.runShopifyCommand(['app', 'info', '--json'])
      fixture.remote.specifications.splice(
        3,
        1,
        specification('ui_extension', 'extension', {
          type: 'object',
          required: ['fixture_required_field'],
        }),
      )
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(2)
      expect(result.stdout).toContain('fixture_required_field')
      expect(operations(result)).toEqual(['ActiveAppReleaseFromApiKey', 'fetchSpecifications'])
    })
  })

  describe('extension dependencies and generated types', () => {
    test('resolves installed exports and generates shopify.d.ts during info', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-extension')
      mockUiSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout).allExtensions).toHaveLength(1)
      await expect(fixture.readFile('extensions/ui/shopify.d.ts')).resolves.toContain(
        "import('@shopify/ui-extensions/admin.product-details.action.render').Api",
      )
      expect(operations(result)).toEqual(linkedOperations)
    })

    test.for([{fixtureName: 'ui-old-api-stale-types'}, {fixtureName: 'ui-no-tsconfig-stale-types'}])(
      'skips installed-package resolution with a closed generation gate $fixtureName',
      async ({fixtureName}, {fixture}) => {
        // GIVEN
        await fixture.reserve(fixtureName)
        mockUiSpecification(fixture)
        // WHEN
        const flags = ['--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode, result.stderr).toBe(0)
        expect(result.stderr).toBe('')
        await expect(fixture.readFile('extensions/ui/shopify.d.ts')).resolves.toBe('stale declarations\n')
      },
    )

    test('identical generated declarations are not rewritten', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-extension')
      mockUiSpecification(fixture)
      await fixture.runShopifyCommand(['app', 'info', '--json'])
      const output = fixture.path('extensions/ui/shopify.d.ts')
      const oldTime = new Date('2000-01-01T00:00:00Z')
      await utimes(output, oldTime, oldTime)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect((await stat(output)).mtime.getTime()).toBe(oldTime.getTime())
      expect(result.after['extensions/ui/shopify.d.ts']).toBe(result.before['extensions/ui/shopify.d.ts'])
    })

    test('installed ShopifyGlobal re-exports change generated declarations', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-shopify-global')
      mockUiSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      await expect(fixture.readFile('extensions/ui/shopify.d.ts')).resolves.toContain('.ShopifyGlobal')
    })

    test('a declared dependency cannot replace a missing installed target export', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-missing-target-export')
      mockUiSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(text(result.stderr)).toContain('Type reference for admin.product-details.action.render could not be found')
    })

    test('successful tools compilation still aborts if its helper export is absent', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-missing-helper-export')
      mockUiSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(text(result.stderr)).toContain('could not be found')
    })

    test('extension UID insertion and generated types are observable writes', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-no-uid')
      mockUiSpecification(fixture)

      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      await expect(fixture.readFile('extensions/ui/shopify.extension.toml')).resolves.toMatch(/uid = "[^"]+"/)
      expect(result.after).toHaveProperty('extensions/ui/shopify.d.ts')
      expect(result.after['extensions/ui/shopify.extension.toml']).not.toBe(
        result.before['extensions/ui/shopify.extension.toml'],
      )
    })

    test('missing source module is a collected error rather than a dependency abort', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-missing-source')
      mockUiSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(2)
      expect(JSON.parse(result.stdout).allExtensions).toHaveLength(1)
      expect(result.after).not.toHaveProperty('extensions/ui/shopify.d.ts')
    })

    test('successful tools compilation adds tool types', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-tools-valid')
      mockUiSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      const declarations = await fixture.readFile('extensions/ui/shopify.d.ts')
      expect(declarations).toBe(`import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/index.ts' {
  interface LookupInput {
    id?: string;
    [k: string]: unknown;
  }

  type LookupOutput = unknown;
  interface ShopifyTools {
    /**
     * Find a fixture
     */
    register(
      name: 'lookup',
      handler: (input: LookupInput) => LookupOutput | Promise<LookupOutput>,
    ): () => void;
  }

  const shopify: import('@shopify/ui-extensions/admin').WithGeneratedTools<
    import('@shopify/ui-extensions/admin.product-details.action.render').Api,
    ShopifyTools
  >;
  const globalThis: { shopify: typeof shopify };
}
`)
      expect(result.stderr).toBe('')
    })

    test.for([
      {fixtureName: 'ui-tools-missing-file', warning: false},
      {fixtureName: 'ui-tools-empty', warning: false},
      {fixtureName: 'ui-tools-invalid-json', warning: true},
      {fixtureName: 'ui-tools-invalid-shape', warning: true},
      {fixtureName: 'ui-tools-duplicate-names', warning: true},
    ])(
      'tools file state $fixtureName preserves base types and its warning boundary',
      async ({fixtureName, warning}, {fixture}) => {
        // GIVEN
        await fixture.reserve(fixtureName)
        mockUiSpecification(fixture)
        // WHEN
        const flags = ['--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode, result.stderr).toBe(0)
        expect(JSON.parse(result.stdout).allExtensions).toHaveLength(1)
        const declarations = await fixture.readFile('extensions/ui/shopify.d.ts')
        expect(declarations).toContain("import('@shopify/ui-extensions/admin.product-details.action.render').Api")
        expect(declarations).not.toContain('ShopifyTools')
        if (warning) {
          expect(text(result.stderr)).toContain(
            fixtureName === 'ui-tools-invalid-shape'
              ? 'Invalid tools definition'
              : 'Failed to create tools type definition',
          )
          expect(result.stderr).toContain('tools.json')
        } else {
          expect(result.stderr).toBe('')
        }
      },
    )

    test.for([
      {fixtureName: 'ui-intent-missing-file', message: 'was not found. Skipping intent type generation'},
      {fixtureName: 'ui-intent-invalid-json', message: 'Failed to create intent type definition'},
      {fixtureName: 'ui-intent-invalid-shape', message: 'Invalid intent schema'},
    ])(
      'missing/invalid intent schema $fixtureName warns without stopping the report',
      async ({fixtureName, message}, {fixture}) => {
        // GIVEN
        await fixture.reserve(fixtureName)
        mockUiSpecification(fixture)
        // WHEN
        const flags = ['--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode, result.stderr).toBe(0)
        expect(text(result.stderr)).toContain(message)
        expect(result.stderr).toContain('intent.json')
        expect(JSON.parse(result.stdout).allExtensions).toHaveLength(1)
        const declarations = await fixture.readFile('extensions/ui/shopify.d.ts')
        expect(declarations).toContain("import('@shopify/ui-extensions/admin.product-details.action.render').Api")
        expect(declarations).not.toContain('ShopifyGeneratedIntentVariants')
      },
    )

    test('valid intent schemas generate input, value, and output declarations', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-intent-valid')
      mockUiSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      const declarations = await fixture.readFile('extensions/ui/shopify.d.ts')
      expect(declarations).toBe(`import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/index.ts' {
  interface EditFixtureIntentInput {
    inputValue?: string;
    [k: string]: unknown;
  }

  interface EditFixtureIntentValue {
    selectedValue?: number;
    [k: string]: unknown;
  }

  type EditFixtureIntentOutput = boolean;

  interface EditFixtureIntentRequest {
    action: 'edit';
    type: 'fixture';
    data: EditFixtureIntentInput;
    value?: EditFixtureIntentValue;
  }

  type ShopifyGeneratedIntentVariants =
    import('@shopify/ui-extensions/admin').ShopifyGeneratedIntentVariant<
      EditFixtureIntentRequest,
      EditFixtureIntentOutput
    >;

  const shopify: import('@shopify/ui-extensions/admin').WithGeneratedIntents<
    import('@shopify/ui-extensions/admin.product-details.action.render').Api,
    ShopifyGeneratedIntentVariants
  >;
  const globalThis: { shopify: typeof shopify };
}
`)
      expect(result.stderr).toBe('')
    })

    test('duplicate valid intent identities abort instead of warning and skipping', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-duplicate-intents')
      mockUiSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(text(result.stderr)).toContain('Intent "edit:fixture" is defined multiple times')
    })

    test('tools JSON external HTTP references use the intercepted native-fetch transport', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-http-schema-reference')
      mockUiSpecification(fixture)
      fixture.mockNetwork({
        method: 'GET',
        url: 'https://schemas.example.test/input.json',
        responses: [{body: {type: 'object', properties: {externalValue: {type: 'string'}}}}],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      expect(
        result.requests.filter((request) => request.url === 'https://schemas.example.test/input.json'),
      ).toHaveLength(1)
      await expect(fixture.readFile('extensions/ui/shopify.d.ts')).resolves.toContain('externalValue')
      expect(result.stderr).toBe('')
    })

    test('local schema references use the process cwd rather than the tools directory', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-local-schema-reference')
      mockUiSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      await expect(fixture.readFile('extensions/ui/shopify.d.ts')).resolves.toContain('rootValue')
      expect(operations(result)).toEqual(linkedOperations)
    })

    test('a failing external schema reference warns and skips tools, not the report', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-http-schema-failure')
      mockUiSpecification(fixture)
      fixture.mockNetwork({
        method: 'GET',
        url: 'https://schemas.example.test/missing.json',
        responses: [{status: 404, text: 'missing'}],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      expect(text(result.stderr)).toContain('Failed to create tools type definition')
      await expect(fixture.readFile('extensions/ui/shopify.d.ts')).resolves.not.toContain('ShopifyTools')
    })

    test('a missing target specification becomes a collected extension error', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('ui-extension')
      mockUiSpecification(fixture)
      fixture.remote.specifications.splice(3)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(2)
      expect(result.stdout).not.toBe('')
      expect(result.after).not.toHaveProperty('extensions/ui/shopify.d.ts')
    })
  })

  describe('remote-defined localized configuration modules', () => {
    test.for([
      {fixtureName: 'localized-module', contents: undefined},
      {fixtureName: 'locales-valid', contents: '{"title":"Fixture"}'},
      {fixtureName: 'locales-not-json', contents: 'not JSON but valid UTF-8'},
    ])('accepts absent or nonempty UTF-8 locale bytes $fixtureName', async ({fixtureName, contents}, {fixture}) => {
      // GIVEN
      await fixture.reserve(fixtureName)
      mockLocalizedSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout).configuration.fixture_configuration).toEqual({enabled: true})
      if (contents !== undefined) await expect(fixture.readFile('locales/en.default.json')).resolves.toBe(contents)
    })

    test.for([
      {fixtureName: 'locales-no-default', message: 'Missing default language'},
      {fixtureName: 'locales-multiple-defaults', message: 'default'},
      {fixtureName: 'locales-empty', message: 'empty'},
    ])('rejects locale file state $fixtureName before rendering', async ({fixtureName, message}, {fixture}) => {
      // GIVEN
      await fixture.reserve(fixtureName)
      mockLocalizedSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode, result.stderr).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(text(result.stderr).toLowerCase()).toContain(message.toLowerCase())
    })

    test('invalid UTF-8 locale bytes abort loading', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('locales-invalid-utf8')
      mockLocalizedSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe('')
      expect(text(result.stderr)).toContain('UTF-8')
    })

    test('unrelated root locales are not validated when no localized configuration spec is active', async ({
      fixture,
    }) => {
      // GIVEN
      await fixture.reserve('inactive-locales')
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
    })
  })

  describe('fixture safety boundaries', () => {
    test('unregistered schema requests fail the test even when type generation catches their errors', async ({
      fixture,
    }) => {
      // GIVEN
      await fixture.reserve('ui-unregistered-schema')
      mockUiSpecification(fixture)
      // WHEN
      const flags = ['--json']
      // THEN
      const command = fixture.runShopifyCommand(['app', 'info', ...flags])
      await expect(command).rejects.toThrow('Unregistered request: GET https://unregistered.example.test/schema.json')
    })

    test('unregistered background version lookup fails even if the command otherwise succeeds', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      await fixture.seedState({
        caches: {},
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const command = fixture.runShopifyCommand(['app', 'info', ...flags])
      await expect(command).rejects.toThrow('registry.npmjs.org')
    })
  })

  describe('deprecation and lifecycle output', () => {
    test('runtime locale controls the date fragment without translating the surrounding warning', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({
        environment: {
          LANG: 'fr_FR.UTF-8',
        },
      })
      fixture.configure({
        environment: {
          LC_ALL: 'fr_FR.UTF-8',
        },
      })
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [
          {
            body: {
              data: {app: fixture.remote.app},
              extensions: {deprecations: [{supportedUntilDate: '2030-01-01T00:00:00Z'}]},
            },
          },
        ],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(text(result.stderr)).toContain('Upgrade to the latest CLI version by 1 janvier 2030.')
    })

    test('prints the earliest future deprecation deadline after the text report', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [
          {
            body: {
              data: {app: fixture.remote.app},
              extensions: {
                deprecations: [
                  {supportedUntilDate: '2031-01-01T00:00:00Z'},
                  {supportedUntilDate: '2030-01-01T00:00:00Z'},
                ],
              },
            },
          },
        ],
      })
      // WHEN
      const flags: string[] = []
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(text(result.stderr)).toContain('Upgrade to the latest CLI version by January 1, 2030.')
      expect(result.stderr.indexOf('CURRENT APP CONFIGURATION')).toBeLessThan(
        result.stderr.indexOf('Upgrade to the latest CLI'),
      )
    })

    test.for([
      {zone: 'UTC', date: 'January 1, 2030'},
      {zone: 'America/Los_Angeles', date: 'December 31, 2029'},
    ])('formats a future deadline in $zone after the report', async ({zone, date}, {fixture}) => {
      // GIVEN
      await fixture.reserve('linked-app')
      fixture.configure({
        environment: {
          TZ: zone,
        },
      })
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [
          {
            body: {
              data: {app: fixture.remote.app},
              extensions: {deprecations: [{supportedUntilDate: '2030-01-01T00:00:00Z'}]},
            },
          },
        ],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).configuration.client_id).toBe(clientId)
      expect(text(result.stderr)).toContain(`Upgrade to the latest CLI version by ${date}.`)
      expect(result.events.filter((event) => event.type === 'spawn')).toEqual([])
    })

    test.for(['2000-01-01T00:00:00Z', new Date(now).toISOString(), 'invalid-date'])(
      'ignores non-future deprecation deadline %s',
      async (date, {fixture}) => {
        // GIVEN
        await fixture.reserve('linked-app')
        fixture.mockNetwork({
          operation: 'ActiveAppReleaseFromApiKey',
          responses: [
            {
              body: {data: {app: fixture.remote.app}, extensions: {deprecations: [{supportedUntilDate: date}]}},
            },
          ],
        })
        // WHEN
        const flags = ['--json']
        // THEN
        const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
        expect(result.exitCode).toBe(0)
        expect(result.stderr).toBe('')
      },
    )

    test('direct exit 2 does not run the deprecation postrun hook', async ({fixture}) => {
      // GIVEN
      await fixture.reserve('empty-web-config')
      fixture.mockNetwork({
        operation: 'ActiveAppReleaseFromApiKey',
        responses: [
          {
            body: {
              data: {app: fixture.remote.app},
              extensions: {deprecations: [{supportedUntilDate: '2030-01-01T00:00:00Z'}]},
            },
          },
        ],
      })
      // WHEN
      const flags = ['--json']
      // THEN
      const result = await fixture.runShopifyCommand(['app', 'info', ...flags])
      expect(result.exitCode).toBe(2)
      expect(JSON.parse(result.stdout).webs).toEqual([])
      expect(result.stderr).not.toContain('Upgrade to the latest CLI')
    })
  })
})
