import {Subdued} from './Subdued.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('Subdued', async () => {
  test('renders correctly', async () => {
    const {lastFrame} = render(<Subdued subdued="my-text" />)

    expect(lastFrame()).toEqual('[2mmy-text[22m')
  })
})
