import {Scrollbar} from './Scrollbar.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('Scrollbar', async () => {
  test('renders correctly when at the top of the list', async () => {
    const options = {
      containerHeight: 10,
      visibleListSectionLength: 10,
      fullListLength: 50,
      visibleFromIndex: 0,
    }

    const {lastFrame} = render(<Scrollbar {...options} />)

    // First 2 are colored in
    expect(lastFrame()).toMatchInlineSnapshot(`
      "\u001b[46m \u001b[49m
      \u001b[46m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m"
    `)
  })

  test('renders correctly when in the middle of the list', async () => {
    const options = {
      containerHeight: 10,
      visibleListSectionLength: 10,
      fullListLength: 50,
      visibleFromIndex: 20,
    }

    const {lastFrame} = render(<Scrollbar {...options} />)

    // Scrollbar is in the middle
    expect(lastFrame()).toMatchInlineSnapshot(`
      "\u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[46m \u001b[49m
      \u001b[46m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m"
    `)
  })

  test('renders correctly when at the bottom of the list', async () => {
    const options = {
      containerHeight: 10,
      visibleListSectionLength: 10,
      fullListLength: 50,
      visibleFromIndex: 40,
    }

    const {lastFrame} = render(<Scrollbar {...options} />)

    // Last 2 are colored in
    expect(lastFrame()).toMatchInlineSnapshot(`
      "\u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[100m \u001b[49m
      \u001b[46m \u001b[49m
      \u001b[46m \u001b[49m"
    `)
  })

  test('renders correctly in the middle of the list in no-color mode', async () => {
    const options = {
      containerHeight: 10,
      visibleListSectionLength: 10,
      fullListLength: 50,
      visibleFromIndex: 20,
      noColor: true,
    }

    const {lastFrame} = render(<Scrollbar {...options} />)
    // Scrollbar is in the middle
    expect(lastFrame()).toMatchInlineSnapshot(`
      "△
      │
      │
      │
      ║
      ║
      │
      │
      │
      ▽"
    `)
  })
})
