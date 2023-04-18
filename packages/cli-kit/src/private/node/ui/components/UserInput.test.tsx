import {UserInput} from './UserInput.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('UserInput', async () => {
  test('renders correctly', async () => {
    const {lastFrame} = render(<UserInput userInput="my-app" />)

    expect(lastFrame()).toMatchInlineSnapshot('"[36mmy-app[39m"')
  })
})
