import {List} from './List.js'
import {renderString} from '../../ui.js'
import {unstyled} from '../../../../output.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('List', async () => {
  test('renders unordered items', async () => {
    const options = {
      title: 'List title',
      items: ['Item 1', 'Item 2', 'Item 3'],
      ordered: false,
    }

    const {output} = renderString(<List {...options} />)

    expect(unstyled(output!)).toMatchInlineSnapshot(`
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

    const {output} = renderString(<List {...options} />)

    expect(unstyled(output!)).toMatchInlineSnapshot(`
      "  1. Item 1
        2. Item 2
        3. Item 3"
    `)
  })
})
