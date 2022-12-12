import {TokenizedText} from './TokenizedText.js'
import {renderString} from '../../ui.js'
import {unstyled} from '../../../../output.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('TokenizedText', async () => {
  test('renders arrays of items separated by spaces', async () => {
    const item = [
      'Run',
      {
        command: 'cd verification-app',
      },
      {
        link: {
          url: 'https://example.com',
          label: 'Example',
        },
      },
      {
        char: '!',
      },
      {
        userInput: 'my-app',
      },
      {
        list: {
          items: ['Item 1', 'Item 2', 'Item 3'],
        },
      },
      {
        filePath: 'src/this/is/a/test.js',
      },
    ]

    const {output} = renderString(<TokenizedText item={item} />)

    expect(unstyled(output!)).toMatchInlineSnapshot(`
      "Run \`cd verification-app\` Example (https://example.com)! my-app
        • Item 1
        • Item 2
        • Item 3
      \\"src/this/is/a/test.js\\""
    `)
  })
})
