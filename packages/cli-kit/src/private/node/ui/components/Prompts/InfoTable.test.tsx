import InfoTable from './InfoTable.js'
import {unstyled} from '../../../../../public/node/output.js'
import {describe, expect, test} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

describe('InfoTable', async () => {
  test('renders a horizontal table with bullet points', async () => {
    const {lastFrame} = render(<InfoTable table={{'header 1': ['some', 'items'], 'header 2': ['one item']}} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "Header 1:  • some
                 • items

      Header 2:  • one item"
    `)
  })
})
