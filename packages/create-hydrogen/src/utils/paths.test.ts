import {template as templatePath} from './paths'
import {it, describe, expect} from 'vitest'

describe('template', () => {
  it('finds the path to the template directory', async function () {
    // TODO run these tests in a sandbox environment
    // When
    const got = await templatePath('template-hydrogen-default')

    // Then
    expect(got).toBeDefined()
  })
})
