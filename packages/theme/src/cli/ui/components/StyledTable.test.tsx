import {StyledTable} from './StyledTable.js'
import {unstyled} from '@shopify/cli-kit/node/output'
import {render} from '@shopify/cli-kit/node/testing/ui'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('StyledTable', () => {
  test('renders a header row and body rows aligned by column width', async () => {
    const {lastFrame} = render(
      <StyledTable
        columns={['name', 'role', 'id']}
        rows={[
          ['Theme 1', '[live]', '#1'],
          ['Theme 2', '', '#2'],
        ]}
      />,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "name     role    id
      Theme 1  [live]  #1
      Theme 2          #2"
    `)
  })

  test('renders the first column subdued when firstColumnSubdued is set', async () => {
    const {lastFrame} = render(<StyledTable columns={['name', 'id']} rows={[['Theme 1', '#1']]} firstColumnSubdued />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "name     id
      Theme 1  #1"
    `)
  })

  test('renders object cells with marker and current suffix, aligning to visible text width', async () => {
    const {lastFrame} = render(
      <StyledTable
        columns={['name', 'role', 'id']}
        rows={[
          [
            {text: 'Theme 1', bold: true},
            {text: '● live', color: '#A7E8BD', bold: true},
            {text: '#1', color: '#8B8296'},
          ],
          ['Theme 2', {text: 'development (current)', color: '#C9A0FF'}, {text: '#2', color: '#8B8296'}],
        ]}
      />,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "name     role                   id
      Theme 1  ● live                 #1
      Theme 2  development (current)  #2"
    `)
  })

  test('truncates the widest column and keeps others intact when the available width is narrow', async () => {
    const {lastFrame} = render(
      <StyledTable
        maxWidth={40}
        columns={['name', 'role', 'id']}
        rows={[['My Very Long Theme Name That Overflows', 'unpublished', '#187417428041']]}
      />,
    )

    const frame = unstyled(lastFrame()!)
    expect(frame).toMatchInlineSnapshot(`
      "name      role         id
      My Very…  unpublished  #187417428041"
    `)
    expect(frame).toContain('…')
    expect(frame).toContain('unpublished')
    expect(frame).toContain('#187417428041')
    frame.split('\n').forEach((line) => {
      expect(line.length).toBeLessThanOrEqual(40)
    })
  })
})
