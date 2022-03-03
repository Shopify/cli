import {vi, describe, it, expect} from 'vitest'
import Pages from 'vite-plugin-pages'

import configuration from './configuration'

vi.mock('vite-plugin-pages', () => ({
  default: () => 'pages',
}))

describe('configuration', () => {
  it('contains the pages plugin', () => {
    // When
    const got = configuration()

    // Then
    expect(got.plugins ?? []).toContain('pages')
  })
})
