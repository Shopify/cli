import {DebugMessage} from './DebugMessage.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('DebugMessage', async () => {
  test('renders correctly with debug prefix', async () => {
    const {lastFrame} = render(<DebugMessage message="Test debug message" />)

    expect(lastFrame()).toMatchInlineSnapshot(`"[2m[DEBUG] Test debug message[22m"`)
  })

  test('handles empty message', async () => {
    const {lastFrame} = render(<DebugMessage message="" />)

    expect(lastFrame()).toMatchInlineSnapshot(`"[2m[DEBUG] [22m"`)
  })
})
