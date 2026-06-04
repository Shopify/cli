import {loadSchemaFromPath, resolveFlowActionUrl} from './utils.js'
import {describe, expect, test} from 'vitest'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('resolveFlowActionUrl', () => {
  test('returns undefined when the URL is not configured', () => {
    expect(resolveFlowActionUrl('validation_url', undefined, 'https://my-app.example.com')).toBeUndefined()
  })

  test('returns absolute URLs unchanged', () => {
    expect(
      resolveFlowActionUrl('runtime_url', 'https://my-prod-host.example.com/api/execute', 'https://my-app.example.com'),
    ).toBe('https://my-prod-host.example.com/api/execute')
  })

  test('prepends the app URL to relative URLs', () => {
    expect(resolveFlowActionUrl('runtime_url', '/api/execute', 'https://my-app.example.com/')).toBe(
      'https://my-app.example.com/api/execute',
    )
  })

  test('throws when a relative URL cannot be resolved without an app URL', () => {
    expect(() => resolveFlowActionUrl('runtime_url', '/api/execute', undefined)).toThrow(
      'Flow action runtime_url is a relative URL, but no application_url is configured. Set application_url in your app configuration or use an absolute HTTPS URL.',
    )
  })

  test('throws when an absolute URL is not HTTPS', () => {
    expect(() => resolveFlowActionUrl('runtime_url', 'http://my-prod-host.example.com/api/execute', undefined)).toThrow(
      'Flow action runtime_url must resolve to an HTTPS URL. Set application_url to an HTTPS URL or use an absolute HTTPS URL.',
    )
  })

  test('throws when a relative URL resolves against a non-HTTPS app URL', () => {
    expect(() => resolveFlowActionUrl('runtime_url', '/api/execute', 'http://my-app.example.com')).toThrow(
      'Flow action runtime_url must resolve to an HTTPS URL. Set application_url to an HTTPS URL or use an absolute HTTPS URL.',
    )
  })
})

describe('loadSchemaFromPath', () => {
  test('loading schema from valid file path should return file contents', async () => {
    const extensionPath = __dirname.concat('/fixtures')
    const patchPath = './valid-schema-patch.graphql'

    const actualSchemaPatch = await loadSchemaFromPath(extensionPath, patchPath)
    const expectedSchemaPatch = await readFile(joinPath(extensionPath, patchPath))

    expect(actualSchemaPatch).toEqual(expectedSchemaPatch)
  })

  test('loading schema from folder directory should throw multiple files error', async () => {
    const extensionPath = __dirname.concat('/fixtures')
    const patchPath = '*.graphql'

    await expect(loadSchemaFromPath(extensionPath, patchPath)).rejects.toThrow('Multiple files found for schema path')
  })

  test('loading schema from invalid file path should throw no file found error', async () => {
    const extensionPath = __dirname.concat('/fixtures')
    const patchPath = './invalid-schema-patch.graphql'

    await expect(loadSchemaFromPath(extensionPath, patchPath)).rejects.toThrow('No file found for schema path')
  })

  test('loading schema with empty path string should return empty string', async () => {
    const extensionPath = __dirname.concat('/fixtures')
    const patchPath = ''

    const result = await loadSchemaFromPath(extensionPath, patchPath)

    expect(result).toEqual('')
  })
})
