import {
  prependSchemaVersionHeader,
  readSchemaApiVersion,
  validateSchemaApiVersion,
  SCHEMA_VERSION_MARKER_PREFIX,
} from './schema-version.js'
import {describe, expect, test} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

function options(directory: string, apiVersion: string) {
  return {directory, localIdentifier: 'my-function', apiVersion}
}

describe('prependSchemaVersionHeader', () => {
  test('prepends a comment block with the version marker', () => {
    const result = prependSchemaVersionHeader('type Query { id: ID }', '2025-10')

    expect(result.startsWith(`${SCHEMA_VERSION_MARKER_PREFIX}2025-10\n`)).toBe(true)
    expect(result.endsWith('type Query { id: ID }')).toBe(true)
  })
})

describe('readSchemaApiVersion', () => {
  test('returns the version when the marker is present', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const path = joinPath(tmpDir, 'schema.graphql')
      await writeFile(path, prependSchemaVersionHeader('type Query { id: ID }', '2025-10'))

      await expect(readSchemaApiVersion(path)).resolves.toEqual('2025-10')
    })
  })

  test('returns undefined when the file has no marker', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const path = joinPath(tmpDir, 'schema.graphql')
      await writeFile(path, '# some other comment\ntype Query { id: ID }')

      await expect(readSchemaApiVersion(path)).resolves.toBeUndefined()
    })
  })

  test('returns undefined when the file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await expect(readSchemaApiVersion(joinPath(tmpDir, 'missing.graphql'))).resolves.toBeUndefined()
    })
  })

  test('does not match the marker once SDL content has started', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const path = joinPath(tmpDir, 'schema.graphql')
      // Marker buried after SDL content should be ignored.
      await writeFile(path, `type Query { id: ID }\n${SCHEMA_VERSION_MARKER_PREFIX}2025-10\n`)

      await expect(readSchemaApiVersion(path)).resolves.toBeUndefined()
    })
  })

  test('trims surrounding whitespace from the marker value', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const path = joinPath(tmpDir, 'schema.graphql')
      await writeFile(path, `${SCHEMA_VERSION_MARKER_PREFIX}  2025-10  \ntype Query { id: ID }`)

      await expect(readSchemaApiVersion(path)).resolves.toEqual('2025-10')
    })
  })
})

describe('validateSchemaApiVersion', () => {
  test('no-ops when the schema file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await expect(validateSchemaApiVersion(options(tmpDir, '2025-10'))).resolves.toBeUndefined()
    })
  })

  test('no-ops when the schema file has no version marker', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await writeFile(joinPath(tmpDir, 'schema.graphql'), 'type Query { id: ID }')

      await expect(validateSchemaApiVersion(options(tmpDir, '2025-10'))).resolves.toBeUndefined()
    })
  })

  test('no-ops when the marker matches the configured api_version', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await writeFile(
        joinPath(tmpDir, 'schema.graphql'),
        prependSchemaVersionHeader('type Query { id: ID }', '2025-10'),
      )

      await expect(validateSchemaApiVersion(options(tmpDir, '2025-10'))).resolves.toBeUndefined()
    })
  })

  test('throws an AbortError with remediation when the marker is stale', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await writeFile(
        joinPath(tmpDir, 'schema.graphql'),
        prependSchemaVersionHeader('type Query { id: ID }', '2025-07'),
      )

      const result = validateSchemaApiVersion(options(tmpDir, '2025-10'))

      await expect(result).rejects.toThrow(AbortError)
      await expect(result).rejects.toThrow(/2025-07[\s\S]*2025-10/)
    })
  })
})
