import functionSpec from './function.js'
import {ExtensionInstance} from '../extension-instance.js'
import {describe, expect, test, vi} from 'vitest'
import {Writable} from 'stream'

vi.mock('../../../services/build/extension.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../services/build/extension.js')>()
  return {...original, buildFunctionExtension: vi.fn().mockResolvedValue(undefined)}
})

describe('function buildConfig', () => {
  test('uses build_steps mode', () => {
    expect(functionSpec.buildConfig.mode).toBe('function')
  })

  test('has a single build-function step', () => {
    const {steps} = functionSpec.clientSteps![0]!

    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({id: 'build-function', type: 'build_function'})
  })

  test('config is serializable to JSON', () => {
    const serialized = JSON.stringify(functionSpec.clientSteps!)
    const deserialized = JSON.parse(serialized)

    expect(deserialized[0].steps).toHaveLength(1)
    expect(deserialized[0].steps[0].type).toBe('build_function')
  })

  test('build_function step invokes buildFunctionExtension', async () => {
    const {buildFunctionExtension} = await import('../../../services/build/extension.js')

    const extension = new ExtensionInstance({
      configuration: {name: 'my-function', type: 'product_discounts', api_version: '2022-07'},
      configurationPath: '',
      directory: '/tmp/func',

      specification: functionSpec as any,
    })

    const buildOptions = {
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
      environment: 'production' as const,
    }

    await extension.build(buildOptions)

    expect(buildFunctionExtension).toHaveBeenCalledWith(extension, buildOptions)
  })
})
