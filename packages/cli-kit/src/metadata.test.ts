import {createRuntimeMetadataContainer} from './metadata.js'
import {describe, expect, it} from 'vitest'

describe('runtime metadata', () => {
  it('can manage data', () => {
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

    container.addPublic({foo: 123})
    container.addSensitive({bar: 'hello'})

    const pub = container.getAllPublic()
    const sensitive = container.getAllSensitive()
    expect(pub).toEqual({foo: 123})
    expect(sensitive).toEqual({bar: 'hello'})

    // getAll returns a copy of the data
    container.addPublic({foo: 456})
    expect(container.getAllPublic()).toEqual({foo: 456})
    expect(pub).toEqual({foo: 123})
  })
})
