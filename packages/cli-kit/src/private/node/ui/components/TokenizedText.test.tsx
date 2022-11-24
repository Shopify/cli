import {TokenizedText} from './TokenizedText.js'
import {renderString} from '../../ui.js'
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
        filePath: 'src/this/is/a/test.js',
      },
      // TODO: fix this
      // {
      //   list: {
      //     items: ['Item 1', 'Item 2', 'Item 3'],
      //   },
      // },
    ]

    const {output} = renderString(<TokenizedText item={item} />)

    expect(output).toMatchInlineSnapshot(`
      "Run \`cd verification-app\` Example [2m(https://example.com)[22m! [36mmy-app[39m
      \\"src/this/is/a/test.js\\""
    `)
  })
})
