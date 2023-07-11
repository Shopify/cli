import {InfoTable} from './InfoTable.js'
import {unstyled} from '../../../../../public/node/output.js'
import {render} from '../../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('InfoTable', async () => {
  test('renders a horizontal table with bullet points', async () => {
    const {lastFrame} = render(
      <InfoTable
        table={{
          'header 1': ['some', 'items'],
          'header 2\nlonger text here': [['one item', {link: {label: 'Shopify', url: 'https://shopify.com'}}]],
        }}
      />,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "Header 1
      • some
      • items

      Header 2
      longer text here
      • one item Shopify ( https://shopify.com )"
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
