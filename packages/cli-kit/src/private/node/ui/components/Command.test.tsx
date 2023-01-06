import {Command} from './Command.js'
import {describe, expect, test} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

describe('Command', async () => {
  test('renders correctly', async () => {
    const {lastFrame} = render(<Command command="npm install" />)

    expect(lastFrame()).toMatchInlineSnapshot('"`npm install`"')
  })
})
