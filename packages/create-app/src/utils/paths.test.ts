import {template as templatePath} from './paths'
import {it, describe, expect} from 'vitest'

describe('template', () => {
  it('finds the path to the template directory', async function () {
    // When
    const got = await templatePath('app')

    // Then
    expect(got).toBeDefined()
  })
})
