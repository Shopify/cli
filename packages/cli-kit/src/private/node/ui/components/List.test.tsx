import {List} from './List.js'
import {unstyled} from '../../../../public/node/output.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('List', async () => {
  test('renders unordered items', async () => {
    const options = {
      title: 'List title',
      items: ['Item 1', 'Item 2', 'Item 3'],
      ordered: false,
    }

    const {lastFrame} = render(<List {...options} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "List title
        • Item 1
        • Item 2
        • Item 3"
    `)
  })

  test('renders ordered items', async () => {
    const options = {
      items: ['Item 1', 'Item 2', 'Item 3'],
      ordered: true,
    }

    const {lastFrame} = render(<List {...options} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "  1. Item 1
        2. Item 2
        3. Item 3"
    `)
  })
})
