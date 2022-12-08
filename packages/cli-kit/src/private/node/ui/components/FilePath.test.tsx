import {FilePath} from './FilePath.js'
import {renderString} from '../../ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('FilePath', async () => {
  test('renders correctly', async () => {
    const {output} = renderString(<FilePath filePath="src/this/is/a/test.js" />)

    expect(output).toMatchInlineSnapshot('"\\"src/this/is/a/test.js\\""')
  })
})
