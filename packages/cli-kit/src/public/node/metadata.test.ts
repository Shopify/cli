import {createRuntimeMetadataContainer} from './metadata.js'
import * as errorHandler from './error-handler.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./error-handler.js')

describe('runtime metadata', () => {
  test('can manage data', async () => {
    const container = createRuntimeMetadataContainer<
      {
        foo: number
      },
      {
        bar: string
      }
    >()

    expect(container.getAllPublicMetadata()).toEqual({})
    expect(container.getAllSensitiveMetadata()).toEqual({})

    await container.addPublicMetadata(() => ({foo: 123}))
    await container.addSensitiveMetadata(() => ({bar: 'hello'}))

    const pub = container.getAllPublicMetadata()
    const sensitive = container.getAllSensitiveMetadata()
    expect(pub).toEqual({foo: 123})
    expect(sensitive).toEqual({bar: 'hello'})

    // getAll returns a copy of the data
    await container.addPublicMetadata(() => ({foo: 456}))
    expect(container.getAllPublicMetadata()).toEqual({foo: 456})
    expect(pub).toEqual({foo: 123})
  })

  test('can mute errors', async () => {
    const container = createRuntimeMetadataContainer<
      {
        foo: number
      },
      {
        bar: string
      }
    >()

    // Mutes a thrown error, but reports it
    await container.addPublicMetadata(() => {
      throw new Error()
    }, 'mute-and-report')

    expect(errorHandler.sendErrorToBugsnag).toHaveBeenCalled()
    vi.mocked(errorHandler.sendErrorToBugsnag).mockReset()

    // Bubbles a thrown error
    await expect(
      container.addPublicMetadata(() => {
        throw new Error()
      }, 'bubble'),
    ).rejects.toThrowError()
    expect(errorHandler.sendErrorToBugsnag).not.toHaveBeenCalled()

    // In mute mode, can handle setting values
    await container.addPublicMetadata(() => ({foo: 123}), 'mute-and-report')
    expect(container.getAllPublicMetadata()).toEqual({foo: 123})
  })
})
