import {showEnv} from './show.js'
import {fetchOrganizations} from '../../dev/fetch.js'
import {AppInterface} from '../../../models/app/app.js'
import {selectOrganizationPrompt} from '../../../prompts/dev.js'
import {testApp, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {OrganizationSource} from '../../../models/organization.js'
import {describe, expect, vi, test} from 'vitest'
import * as file from '@shopify/cli-kit/node/fs'
import {stringifyMessage, unstyled} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('../../dev/fetch.js')
vi.mock('../../../prompts/dev.js')
vi.mock('@shopify/cli-kit/node/node-package-manager')

describe('env show', () => {
  test('outputs the new environment', async () => {
    // Given
    vi.spyOn(file, 'writeFile')

    const app = mockApp()
    const remoteApp = testOrganizationApp()
    const organization = {
      id: '123',
      flags: {},
      businessName: 'test',
      source: OrganizationSource.BusinessPlatform,
      apps: {nodes: []},
    }

    vi.mocked(fetchOrganizations).mockResolvedValue([organization])
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(organization)

    // When
    const result = await showEnv(app, remoteApp, organization)

    // Then
    expect(file.writeFile).not.toHaveBeenCalled()
    expect(unstyled(stringifyMessage(result))).toMatchInlineSnapshot(`
    "
        SHOPIFY_API_KEY=api-key
        SHOPIFY_API_SECRET=api-secret
        SCOPES=my-scope
      "
    `)
  })
})

function mockApp(currentVersion = '2.2.2'): AppInterface {
  const nodeDependencies: {[key: string]: string} = {}
  nodeDependencies['@shopify/cli'] = currentVersion
  return testApp({
    name: 'myapp',
    directory: '/',
    configuration: {
      path: joinPath('/', 'shopify.app.toml'),
      scopes: 'my-scope',
    },
    nodeDependencies,
  })
}
