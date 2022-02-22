import {it, describe, expect} from 'vitest'

import {template as templatePath} from './paths'

describe('template', () => {
  it('finds the path to the template directory', async function () {
    // When
    const got = await templatePath('app')

    // Then
    expect(got).toBeDefined()
  })
})
