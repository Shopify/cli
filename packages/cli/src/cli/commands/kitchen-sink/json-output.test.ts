import KitchenSinkJsonOutput from './json-output.js'
import {kitchenSinkJsonOutputSchema} from '../../services/kitchen-sink/json-output.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {Config} from '@oclif/core'
import {afterEach, describe, expect, test} from 'vitest'
import {fileURLToPath} from 'node:url'

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('kitchen-sink json-output command', () => {
  test('prints the validated JSON result', async () => {
    const output = mockAndCaptureOutput()
    await KitchenSinkJsonOutput.run(['--json'], import.meta.url)

    const sideEvents = output
      .info()
      .split('\n')
      .slice(0, 3)
      .map((line) => JSON.parse(line) as unknown)
    expect(sideEvents).toMatchObject([
      {type: 'progress', message: 'Preparing the sample result'},
      {type: 'diagnostic', level: 'info', message: 'Preparing the sample result.'},
      {type: 'progress', message: 'Preparing the sample result', current: 1, total: 1},
    ])
    expect(output.info()).toContain(kitchenSinkJsonOutputSchema.encode({items: [{id: 1, name: 'Example'}]}))
  })

  test('prints a human-readable result', async () => {
    const output = mockAndCaptureOutput()
    await KitchenSinkJsonOutput.run([], import.meta.url)

    expect(output.info()).toContain('Prepared 1 item.')
  })

  test('exposes its JSON schema', () => {
    expect(KitchenSinkJsonOutput.jsonOutputSchema).toBe(kitchenSinkJsonOutputSchema)
  })

  test('can exercise JSON error handling', async () => {
    const config = await Config.load(fileURLToPath(import.meta.url))

    await expect(new KitchenSinkJsonOutput(['--fail'], config).run()).rejects.toThrow('Sample command failure.')
  })
})
