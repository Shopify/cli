import {Command} from './Command.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('Command', async () => {
  test('renders correctly', async () => {
    const {lastFrame} = render(<Command command="npm install" />)

    expect(lastFrame()).toMatchInlineSnapshot('"[95m`npm install`[39m"')
  })
})
