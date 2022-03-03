import {it, describe, expect} from 'vitest'

import {template as templatePath} from './paths'

describe('template', () => {
  it('finds the path to the template directory', async function () {
    // TODO run these tests in a sandbox environment
    // When
    const got = await templatePath('template-hydrogen-default')

    // Then
    expect(got).toBeDefined()
  })
})
