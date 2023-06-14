import link, {LinkOptions} from './link.js'
import {OrganizationApp} from '../../../models/organization.js'
import {testApp} from '../../../models/app/app.test-data.js'
import {selectConfigName} from '../../../prompts/config.js'
import {selectApp} from '../select-app.js'
import {load} from '../../../models/app/loader.js'
import {describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {inTemporaryDirectory, readFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

const LOCAL_APP = testApp()
const REMOTE_APP: OrganizationApp = {
  id: '1',
  title: 'app1',
  apiKey: 'api-key',
  apiSecretKeys: [{secret: 'secret1'}],
  organizationId: '1',
  grantedScopes: [],
  applicationUrl: 'https://example.com',
}

vi.mock('../../../prompts/config.js')
vi.mock('../select-app.js')
vi.mock('../../../models/app/loader.js')
vi.mock('@shopify/cli-kit/node/ui')

describe('link', () => {
  test('creates a new config file when it does not exist', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(load).mockResolvedValue(LOCAL_APP)
      vi.mocked(selectApp).mockResolvedValue(REMOTE_APP)
      vi.mocked(selectConfigName).mockResolvedValue('staging')

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.staging.toml'))
      const expectedContent = `scopes = ""
extensionDirectories = [ ]

[credentials]
clientId = "api-key"

[appInfo]
name = "app1"

[web]
appUrl = "https://example.com"
`
      expect(content).toEqual(expectedContent)
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'App "app1" connected to this codebase, file shopify.app.staging.toml created',
      })
    })
  })

  test('updates the config file when it already exists', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.staging.toml')
      const initialContent = `scopes = ""

      [appInfo]
      name = "other-app"
      `
      writeFileSync(filePath, initialContent)
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(load).mockResolvedValue(LOCAL_APP)
      vi.mocked(selectApp).mockResolvedValue(REMOTE_APP)
      vi.mocked(selectConfigName).mockResolvedValue('staging')

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.staging.toml'))
      const expectedContent = `scopes = ""
extensionDirectories = [ ]

[credentials]
clientId = "api-key"

[appInfo]
name = "app1"

[web]
appUrl = "https://example.com"
`
      expect(content).toEqual(expectedContent)
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'App "app1" connected to this codebase, file shopify.app.staging.toml updated',
      })
    })
  })
})
