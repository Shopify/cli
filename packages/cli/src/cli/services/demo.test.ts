import {demoStepsSchema} from './demo.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {fileURLToPath} from 'url'

describe('demoStepsSchema', () => {
  test('validates catalog', async () => {
    const filePath = joinPath(fileURLToPath(dirname(import.meta.url)), '../../../assets/demo-catalog.json')
    const catalogContents = demoStepsSchema.parse(JSON.parse(await readFile(filePath)))
    expect(catalogContents.command).toEqual('shopify demo')
  })
})
