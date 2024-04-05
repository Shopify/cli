import {tokenItemToString, TokenizedText} from './TokenizedText.js'
import {unstyled} from '../../../../public/node/output.js'
import {render} from '../../testing/ui.js'
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
        subdued: '(my-text)',
      },
      {
        list: {
          items: ['Item 1', 'Item 2', 'Item 3'],
        },
      },
      {
        filePath: 'src/this/is/a/test.js',
      },
      {
        info: 'some info',
      },
      {
        warn: 'some warn',
      },
      {
        error: 'some error',
      },
    ]

    const {lastFrame} = render(<TokenizedText item={item} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "Run \`cd verification-app\` Example ( https://example.com )! my-app (my-text)
        • Item 1
        • Item 2
        • Item 3
      src/this/is/a/test.js some info some warn some error"
    `)
  })

  describe('tokenItemToString', async () => {
    test("doesn't add a space before char", async () => {
      expect(tokenItemToString(['Run', {char: '!'}])).toBe('Run!')
    })

    test('it concatenates list items inline', async () => {
      expect(
        tokenItemToString([
          'Run',
          {
            list: {
              items: ['Item 1', 'Item 2', 'Item 3'],
            },
          },
        ]),
      ).toBe('Run Item 1 Item 2 Item 3')
    })
  })
})
