import {UserInput} from './UserInput.js'
import {renderString} from '../../ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('UserInput', async () => {
  test('renders correctly', async () => {
    const {output} = renderString(<UserInput userInput="my-app" />)

    expect(output).toMatchInlineSnapshot('"[36mmy-app[39m"')
  })
})
