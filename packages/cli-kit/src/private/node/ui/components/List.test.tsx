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

  test('renders items with margin or not', async () => {
    const options = {
      items: ['Item 1', 'Item 2', 'Item 3'],
      margin: true,
    }

    const {lastFrame: marginLastFrame} = render(<List {...options} />)

    expect(unstyled(marginLastFrame()!)).toMatchInlineSnapshot(`
      "  • Item 1
        • Item 2
        • Item 3"
    `)

    const {lastFrame: noMarginLastFrame} = render(<List {...options} margin={false} />)

    expect(unstyled(noMarginLastFrame()!)).toMatchInlineSnapshot(`
      "• Item 1
      • Item 2
      • Item 3"
    `)
  })

  test('can give the text a color', async () => {
    const options = {
      title: 'List title',
      items: ['Item 1', 'Item 2', 'Item 3'],
      color: 'red',
    }

    const {lastFrame} = render(<List {...options} />)

    expect(lastFrame()).toMatchInlineSnapshot(`
      "[31mList title[39m
        [31m•[39m [31mItem 1[39m
        [31m•[39m [31mItem 2[39m
        [31m•[39m [31mItem 3[39m"
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

  test('title can be made of tokens', async () => {
    const options = {
      title: [
        'List title',
        {
          bold: ' (bold)',
        },
      ],
      items: ['Item 1', 'Item 2', 'Item 3'],
      ordered: false,
    }

    const {lastFrame} = render(<List {...options} />)

    expect(lastFrame()).toMatchInlineSnapshot(`
      "List title [1m (bold)[22m
        • Item 1
        • Item 2
        • Item 3"
    `)
  })

  test('renders custom items', async () => {
    const options = {
      items: [
        {bullet: '-', color: 'red', item: 'Custom Item 1'},
        'Item 1',
        {bullet: '_', color: 'green', item: 'Custom Item 2'},
      ],
      bullet: '*',
      color: 'gray',
    }

    const {lastFrame} = render(<List {...options} />)

    expect(lastFrame()!).toMatchInlineSnapshot(`
      "  [31m-[39m [31mCustom Item 1[39m
        [90m*[39m [90mItem 1[39m
        [32m_[39m [32mCustom Item 2[39m"
    `)
  })
})
