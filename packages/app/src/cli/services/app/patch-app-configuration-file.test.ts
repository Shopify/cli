import {patchAppConfigurationFile} from './patch-app-configuration-file.js'
import {readFile, writeFileSync, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

const defaultToml = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration
client_id = "12345"
name = "app1"
application_url = "https://example.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
use_legacy_install_flow = true
`

function writeDefaulToml(tmpDir: string) {
  const configPath = joinPath(tmpDir, 'shopify.app.toml')
  writeFileSync(configPath, defaultToml)
  return configPath
}

describe('patchAppConfigurationFile', () => {
  test('updates existing configuration with new values and adds new top-levelfields', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)
      const patch = {
        name: 'Updated App Name',
        new_field: 'new value',
        access_scopes: {
          use_legacy_install_flow: false,
        },
      }

      await patchAppConfigurationFile(configPath, patch)

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile)
        .toEqual(`# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

client_id = "12345"
name = "Updated App Name"
application_url = "https://example.com"
embedded = true
new_field = "new value"

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
use_legacy_install_flow = false
`)
    })
  })

  test('Adds new table to the toml file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)
      const patch = {
        build: {
          command: 'echo "Build command"',
        },
      }

      await patchAppConfigurationFile(configPath, patch)

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile)
        .toEqual(`# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

client_id = "12345"
name = "app1"
application_url = "https://example.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
use_legacy_install_flow = true

[build]
command = 'echo "Build command"'
`)
    })
  })
})
