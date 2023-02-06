import {InfoTable} from './InfoTable.js'
import {unstyled} from '../../../../../public/node/output.js'
import {describe, expect, test} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

describe('InfoTable', async () => {
  test('renders a horizontal table with bullet points', async () => {
    const {lastFrame} = render(
      <InfoTable
        table={{
          'header 1': ['some', 'items'],
          'header 2': [['one item', {link: {label: 'Shopify', url: 'https://shopify.com'}}]],
        }}
      />,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "Header 1:  • some
                 • items

      Header 2:  • one item Shopify ( https://shopify.com )"
    `)
  })

  test('supports an empty header value', async () => {
    const {lastFrame} = render(
      <InfoTable
        table={{
          '': ['some', 'items'],
        }}
      />,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "• some
      • items"
    `)
  })
})
