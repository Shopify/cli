import {FilePath} from './FilePath.js'
import {describe, expect, test} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

describe('FilePath', async () => {
  test('renders correctly', async () => {
    const {lastFrame} = render(<FilePath filePath="src/this/is/a/test.js" />)

    expect(lastFrame()).toMatchInlineSnapshot('"[3msrc/this/is/a/test.js[23m"')
  })
})
