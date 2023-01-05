import {UserInput} from './UserInput.js'
import {describe, expect, test} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

describe('UserInput', async () => {
  test('renders correctly', async () => {
    const {lastFrame} = render(<UserInput userInput="my-app" />)

    expect(lastFrame()).toMatchInlineSnapshot('"[36mmy-app[39m"')
  })
})
