import {rewriteSchemaDirective, syncSchemaDirectives} from './sync-schema-directives.js'
import {CachedSchemaIndex} from './write-cached-schemas.js'
import {testAppLinked} from '../../models/app/app.test-data.js'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

const CACHE_ROOT = '/app/.shopify/schemas'

describe('rewriteSchemaDirective', () => {
  test('prepends a directive when none is present', () => {
    // Given
    const raw = 'name = "test-app"\nclient_id = "abc"\n'

    // When
    const result = rewriteSchemaDirective(
      raw,
      '/app/shopify.app.toml',
      '/app/.shopify/schemas/app.schema.json',
      CACHE_ROOT,
    )

    // Then
    expect(result).toBe('#:schema ./.shopify/schemas/app.schema.json\n\nname = "test-app"\nclient_id = "abc"\n')
  })

  test('returns the original string when the directive already matches (idempotent)', () => {
    // Given
    const raw = '#:schema ./.shopify/schemas/app.schema.json\nname = "x"\n'

    // When
    const result = rewriteSchemaDirective(
      raw,
      '/app/shopify.app.toml',
      '/app/.shopify/schemas/app.schema.json',
      CACHE_ROOT,
    )

    // Then
    expect(result).toBe(raw)
  })

  test('rewrites a directive that points at a different file inside the cache', () => {
    // Given — existing directive points at an outdated cached schema for this extension folder.
    const raw = '#:schema ../../.shopify/schemas/extensions/old_type.schema.json\nname = "x"\n'

    // When
    const result = rewriteSchemaDirective(
      raw,
      '/app/extensions/my-ext/shopify.extension.toml',
      '/app/.shopify/schemas/extensions/ui_extension.schema.json',
      CACHE_ROOT,
    )

    // Then
    expect(result).toBe('#:schema ../../.shopify/schemas/extensions/ui_extension.schema.json\nname = "x"\n')
  })

  test('leaves a directive pointing at a custom URL untouched', () => {
    // Given
    const raw = '#:schema https://example.com/my-schema.json\nname = "x"\n'

    // When
    const result = rewriteSchemaDirective(
      raw,
      '/app/shopify.app.toml',
      '/app/.shopify/schemas/app.schema.json',
      CACHE_ROOT,
    )

    // Then
    expect(result).toBeNull()
  })

  test('leaves a directive pointing at a path outside the cache untouched', () => {
    // Given
    const raw = '#:schema ./my-custom-schemas/app.json\nname = "x"\n'

    // When
    const result = rewriteSchemaDirective(
      raw,
      '/app/shopify.app.toml',
      '/app/.shopify/schemas/app.schema.json',
      CACHE_ROOT,
    )

    // Then
    expect(result).toBeNull()
  })

  test('tolerates whitespace variations like `# :schema` when detecting', () => {
    // Given
    const raw = '# :schema ./.shopify/schemas/app.schema.json\nname = "x"\n'

    // When
    const result = rewriteSchemaDirective(
      raw,
      '/app/shopify.app.toml',
      '/app/.shopify/schemas/app.schema.json',
      CACHE_ROOT,
    )

    // Then
    expect(result).toBe(raw)
  })
})

describe('syncSchemaDirectives', () => {
  test('prepends a directive to the app TOML when missing', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const appTomlPath = joinPath(tmp, 'shopify.app.toml')
      const schemaPath = joinPath(tmp, '.shopify/schemas/app.schema.json')
      await writeFile(appTomlPath, 'name = "x"\n')
      await mkdir(joinPath(tmp, '.shopify/schemas'))
      await writeFile(schemaPath, '{}')

      const app = testAppLinked({directory: tmp, configPath: appTomlPath, allExtensions: []})
      const index: CachedSchemaIndex = {
        appSchemaPath: schemaPath,
        extensionSchemaByIdentifier: new Map(),
      }

      // When
      await syncSchemaDirectives(app, index)

      // Then
      const updated = await readFile(appTomlPath)
      expect(updated.startsWith('#:schema ./.shopify/schemas/app.schema.json\n\n')).toBe(true)
    })
  })

  test('does not rewrite when the directive already matches', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const appTomlPath = joinPath(tmp, 'shopify.app.toml')
      const schemaPath = joinPath(tmp, '.shopify/schemas/app.schema.json')
      const original = '#:schema ./.shopify/schemas/app.schema.json\nname = "x"\n'
      await writeFile(appTomlPath, original)
      await mkdir(joinPath(tmp, '.shopify/schemas'))
      await writeFile(schemaPath, '{}')

      const app = testAppLinked({directory: tmp, configPath: appTomlPath, allExtensions: []})
      const index: CachedSchemaIndex = {
        appSchemaPath: schemaPath,
        extensionSchemaByIdentifier: new Map(),
      }

      // When
      await syncSchemaDirectives(app, index)

      // Then
      await expect(readFile(appTomlPath)).resolves.toBe(original)
    })
  })

  test('leaves the app TOML directive alone when an extension reports the app TOML as its configurationPath', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given — webhook_subscription extensions are inline in shopify.app.toml and report
      // configurationPath = shopify.app.toml. We must not overwrite the app directive with theirs.
      const appTomlPath = joinPath(tmp, 'shopify.app.toml')
      const appSchemaPath = joinPath(tmp, '.shopify/schemas/app.schema.json')
      const webhookSchemaPath = joinPath(tmp, '.shopify/schemas/extensions/webhook_subscription.schema.json')
      await writeFile(appTomlPath, 'name = "x"\n')
      await mkdir(joinPath(tmp, '.shopify/schemas/extensions'))
      await writeFile(appSchemaPath, '{}')
      await writeFile(webhookSchemaPath, '{}')

      const webhookExtension = {
        configurationPath: appTomlPath,
        specification: {identifier: 'webhook_subscription'},
      }
      const app = testAppLinked({
        directory: tmp,
        configPath: appTomlPath,
        allExtensions: [webhookExtension as any],
      })
      const index: CachedSchemaIndex = {
        appSchemaPath,
        extensionSchemaByIdentifier: new Map([['webhook_subscription', webhookSchemaPath]]),
      }

      // When
      await syncSchemaDirectives(app, index)

      // Then — the app directive wins.
      const updated = await readFile(appTomlPath)
      expect(updated.startsWith('#:schema ./.shopify/schemas/app.schema.json\n')).toBe(true)
    })
  })

  test('does not throw when a TOML file is missing — logs and continues', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given — configPath points at a file that doesn't exist
      const app = testAppLinked({
        directory: tmp,
        configPath: joinPath(tmp, 'shopify.app.toml'),
        allExtensions: [],
      })
      const index: CachedSchemaIndex = {
        appSchemaPath: joinPath(tmp, '.shopify/schemas/app.schema.json'),
        extensionSchemaByIdentifier: new Map(),
      }

      // When/Then — no throw
      await expect(syncSchemaDirectives(app, index)).resolves.toBeUndefined()
    })
  })
})
