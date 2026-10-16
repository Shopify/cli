/* eslint-disable no-restricted-imports -- capability detection runs against real temporary repositories */
import {scan} from '../scanners/index.js'
import {afterEach, describe, expect, test} from 'vitest'
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {Capabilities} from '../types.js'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})))
})

async function app(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'app-security-capabilities-'))
  directories.push(directory)
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const fullPath = join(directory, path)
      await mkdir(join(fullPath, '..'), {recursive: true})
      await writeFile(fullPath, content)
    }),
  )
  return directory
}

const NO_CAPABILITIES: Capabilities = {
  theme_app_extension: false,
  app_embed: false,
  embedded_app: false,
  script_tags: false,
  webhooks: false,
  app_proxy: false,
  storefront_metafield_writes: false,
  has_backend: false,
  declared_ip_allowlist: false,
  checkout_extension: false,
}

describe('capability detection', () => {
  test('reports no capabilities for a configuration-only app', async () => {
    const result = await scan(await app({'shopify.app.toml': 'name = "Bare"\n'}))

    expect(result.capabilities).toEqual(NO_CAPABILITIES)
  })

  test('reports capabilities observed in configuration, extensions, and source', async () => {
    const result = await scan(
      await app({
        'shopify.app.toml': `name = "Observed"
[app_proxy]
url = "https://app.example/proxy"
subpath = "tools"
prefix = "apps"
[webhooks]
api_version = "2026-07"
[[webhooks.subscriptions]]
topics = ["orders/create"]
uri = "https://app.example/webhooks"
`,
        'extensions/checkout/shopify.extension.toml': 'type = "checkout_ui_extension"\n',
        'app/routes/orders.ts': 'export const action = async () => null',
        'app/script-tags.ts': 'await admin.rest.resources.ScriptTag.save({})',
        'app/metafields.ts': 'await admin.graphql(`mutation { metafieldsSet(metafields: $input) { id } }`)',
      }),
    )

    expect(result.capabilities).toEqual({
      ...NO_CAPABILITIES,
      app_proxy: true,
      webhooks: true,
      checkout_extension: true,
      has_backend: true,
      script_tags: true,
      storefront_metafield_writes: true,
    })
  })

  test('recognizes Express-style routes and the checkout_ui extension alias', async () => {
    const result = await scan(
      await app({
        'shopify.app.toml': 'name = "Express"\n',
        'extensions/checkout/shopify.extension.toml': 'type = "checkout_ui"\n',
        'server.js': "app.post('/webhooks', handler)",
      }),
    )

    expect(result.capabilities).toEqual({...NO_CAPABILITIES, checkout_extension: true, has_backend: true})
  })
})
