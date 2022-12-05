import {Command} from './Command.js'
import {renderString} from '../../ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('Command', async () => {
  test('renders correctly', async () => {
    const {output} = renderString(<Command command="npm install" />)

    expect(output).toMatchInlineSnapshot('"`npm install`"')
  })
})
