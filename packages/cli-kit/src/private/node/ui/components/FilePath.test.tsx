import {FilePath} from './FilePath.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('FilePath', async () => {
  test('renders correctly', async () => {
    const {lastFrame} = render(<FilePath filePath="src/this/is/a/test.js" />)

    expect(lastFrame()).toMatchInlineSnapshot('"[3msrc/this/is/a/test.js[23m"')
  })
})
