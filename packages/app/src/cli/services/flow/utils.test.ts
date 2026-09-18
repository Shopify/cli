import {loadSchemaFromPath} from './utils.js'
import {describe, expect, test} from 'vitest'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

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
