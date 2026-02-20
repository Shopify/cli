import taxCalculationSpec from './tax_calculation.js'
import {ExtensionInstance} from '../extension-instance.js'
import {ExtensionBuildOptions} from '../../../services/build/extension.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {Writable} from 'stream'

describe('tax_calculation buildConfig', () => {
  test('uses build_steps mode', () => {
    expect(taxCalculationSpec.buildConfig.mode).toBe('tax_calculation')
  })

  test('has a single create-tax-stub step', () => {
    if (taxCalculationSpec.buildConfig.mode === 'none') throw new Error('Expected build_steps mode')

    const {steps} = taxCalculationSpec.buildConfig

    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({id: 'create-tax-stub', type: 'create_tax_stub'})
  })

  test('config is serializable to JSON', () => {
    if (taxCalculationSpec.buildConfig.mode === 'none') throw new Error('Expected build_steps mode')

    const serialized = JSON.stringify(taxCalculationSpec.buildConfig)
    const deserialized = JSON.parse(serialized)

    expect(deserialized.steps).toHaveLength(1)
    expect(deserialized.steps[0].type).toBe('create_tax_stub')
  })

  describe('build integration', () => {
    test('creates the stub JS file at outputPath', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extension = new ExtensionInstance({
          configuration: {name: 'tax-calc', type: 'tax_calculation'},
          configurationPath: '',
          directory: tmpDir,

          specification: taxCalculationSpec as any,
        })

        const buildOptions: ExtensionBuildOptions = {
          stdout: new Writable({
            write(chunk, enc, cb) {
              cb()
            },
          }),
          stderr: new Writable({
            write(chunk, enc, cb) {
              cb()
            },
          }),
          app: {} as any,
          environment: 'production',
        }

        // When
        await extension.build(buildOptions)

        // Then
        const content = await readFile(extension.outputPath)
        expect(content).toBe('(()=>{})();')
      })
    })
  })
})
