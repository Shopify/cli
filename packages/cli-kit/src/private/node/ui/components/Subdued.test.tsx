import {Subdued} from './Subdued.js'
import {describe, expect, test} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

describe('Subdued', async () => {
  test('renders correctly', async () => {
    const {lastFrame} = render(<Subdued subdued="my-text" />)

    expect(lastFrame()).toEqual('[2mmy-text[22m')
  })
})
