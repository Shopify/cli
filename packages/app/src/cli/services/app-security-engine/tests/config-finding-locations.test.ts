import {scanDirectory} from './scan-directory.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {decodeToml} from '@shopify/cli-kit/node/toml/codec'
import {expect, test} from 'vitest'

test('reports file-level config findings when a valid TOML value exceeds the location nesting limit', async () => {
  const content = [
    'name = "Nested configuration"',
    `extra = ${'['.repeat(5000)}1${']'.repeat(5000)}`,
    '[access_scopes]',
    'scopes = "write_script_tags"',
    '[webhooks]',
    'api_version = "2020-01"',
    '[auth]',
    'redirect_urls = ["http://app.example/callback"]',
    '',
  ].join('\n')

  expect(decodeToml(content)).toMatchObject({webhooks: {api_version: '2020-01'}})

  await inTemporaryDirectory(async (directory) => {
    await writeFile(joinPath(directory, 'shopify.app.toml'), content)

    const result = await scanDirectory(directory)

    for (const id of ['DEPRECATED_SCRIPT_TAG_SCOPE', 'EOL_API_VERSION', 'INSECURE_WEBHOOK_URL']) {
      expect(result.issues.filter((issue) => issue.id === id).map(({location}) => location)).toEqual([
        {file: 'shopify.app.toml'},
      ])
    }
  })
})
