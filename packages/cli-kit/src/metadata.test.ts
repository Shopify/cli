import {createRuntimeMetadataContainer} from './metadata.js'
import * as errorHandler from './public/node/error-handler.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'

describe('runtime metadata', () => {
  beforeEach(() => {
    vi.mock('./public/node/error-handler.js')
  })

  it('can manage data', async () => {
    const container = createRuntimeMetadataContainer<
      {
        foo: number
      },
      {
        bar: string
      }
    >()

    expect(container.getAllPublic()).toEqual({})
    expect(container.getAllSensitive()).toEqual({})

    await container.addPublic(() => ({foo: 123}))
    await container.addSensitive(() => ({bar: 'hello'}))

    const pub = container.getAllPublic()
    const sensitive = container.getAllSensitive()
    expect(pub).toEqual({foo: 123})
    expect(sensitive).toEqual({bar: 'hello'})

    // getAll returns a copy of the data
    await container.addPublic(() => ({foo: 456}))
    expect(container.getAllPublic()).toEqual({foo: 456})
    expect(pub).toEqual({foo: 123})
  })

  it('can mute errors', async () => {
    const container = createRuntimeMetadataContainer<
      {
        foo: number
      },
      {
        bar: string
      }
    >()

    // Mutes a thrown error, but reports it
    await container.addPublic(() => {
      throw new Error()
    }, 'mute-and-report')

    expect(errorHandler.sendErrorToBugsnag).toHaveBeenCalled()
    vi.mocked(errorHandler.sendErrorToBugsnag).mockReset()

    // Bubbles a thrown error
    await expect(
      container.addPublic(() => {
        throw new Error()
      }, 'bubble'),
    ).rejects.toThrowError()
    expect(errorHandler.sendErrorToBugsnag).not.toHaveBeenCalled()

    // In mute mode, can handle setting values
    await container.addPublic(() => ({foo: 123}), 'mute-and-report')
    expect(container.getAllPublic()).toEqual({foo: 123})
  })
})
