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

  // test('handles empty initial configuration', async () => {
  //   await inTemporaryDirectory(async (tmpDir) => {
  //     const configPath = joinPath(tmpDir, 'shopify.app.toml')
  //     const patch = {
  //       name: 'New App',
  //       scopes: 'read_products,write_products',
  //     }

  //     vi.mocked(readFile).mockResolvedValue('')
  //     vi.mocked(decodeToml).mockReturnValue({})
  //     vi.mocked(encodeToml).mockReturnValue('new toml content')

  //     await patchAppConfigurationFile(configPath, patch)

  //     expect(readFile).toHaveBeenCalledWith(configPath)
  //     expect(decodeToml).toHaveBeenCalledWith('')
  //     expect(encodeToml).toHaveBeenCalledWith(patch)
  //     expect(writeFileSync).toHaveBeenCalledWith(configPath, 'new toml content')
  //   })
  // })

  // test('overwrites existing values with patch values', async () => {
  //   await inTemporaryDirectory(async (tmpDir) => {
  //     const configPath = joinPath(tmpDir, 'shopify.app.toml')
  //     const initialConfig = {
  //       name: 'My App',
  //       scopes: 'read_products',
  //       client_id: '12345',
  //     }
  //     const patch = {
  //       name: 'New Name',
  //       scopes: 'write_products',
  //     }

  //     vi.mocked(readFile).mockResolvedValue('initial toml content')
  //     vi.mocked(decodeToml).mockReturnValue(initialConfig)
  //     vi.mocked(encodeToml).mockReturnValue('updated toml content')

  //     await patchAppConfigurationFile(configPath, patch)

  //     expect(encodeToml).toHaveBeenCalledWith({
  //       name: 'New Name',
  //       scopes: 'write_products',
  //       client_id: '12345',
  //     })
  //   })
  // })

  // test('handles errors when reading the file', async () => {
  //   await inTemporaryDirectory(async (tmpDir) => {
  //     const configPath = joinPath(tmpDir, 'shopify.app.toml')
  //     const patch = {name: 'New App'}

  //     vi.mocked(readFile).mockRejectedValue(new Error('File not found'))

  //     await expect(patchAppConfigurationFile(configPath, patch)).rejects.toThrow('File not found')
  //   })
  // })

  // test('handles errors when writing the file', async () => {
  //   await inTemporaryDirectory(async (tmpDir) => {
  //     const configPath = joinPath(tmpDir, 'shopify.app.toml')
  //     const patch = {name: 'New App'}

  //     vi.mocked(readFile).mockResolvedValue('initial toml content')
  //     vi.mocked(decodeToml).mockReturnValue({})
  //     vi.mocked(encodeToml).mockReturnValue('updated toml content')
  //     vi.mocked(writeFileSync).mockImplementation(() => {
  //       throw new Error('Write error')
  //     })

  //     await expect(patchAppConfigurationFile(configPath, patch)).rejects.toThrow('Write error')
  //   })
  // })
})
