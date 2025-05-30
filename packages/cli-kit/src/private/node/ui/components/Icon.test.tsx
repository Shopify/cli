import {Icon} from './Icon.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('Icon', async () => {
  test('renders success icon correctly', async () => {
    const {lastFrame} = render(<Icon type="success" />)

    expect(lastFrame()).toMatchInlineSnapshot(`"[32m✓[39m"`)
  })

  test('renders fail icon correctly', async () => {
    const {lastFrame} = render(<Icon type="fail" />)

    expect(lastFrame()).toMatchInlineSnapshot(`"[31m✗[39m"`)
  })

  test('renders warning icon correctly', async () => {
    const {lastFrame} = render(<Icon type="warning" />)

    expect(lastFrame()).toMatchInlineSnapshot(`"[33m⚠[39m"`)
  })

  test('renders info icon correctly', async () => {
    const {lastFrame} = render(<Icon type="info" />)

    expect(lastFrame()).toMatchInlineSnapshot(`"[34mℹ[39m"`)
  })
})
