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
      {
        color: {
          text: 'green text',
          color: 'green',
        },
      },
      {
        json: {key: 'value'},
      },
      {
        icon: 'success',
      },
      {
        debug: 'debug info',
      },
    ]

    const {lastFrame} = render(<TokenizedText item={item} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "Run \`cd verification-app\` Example ( https://example.com )! my-app (my-text)
        • Item 1
        • Item 2
        • Item 3
      src/this/is/a/test.js some info some warn some error green text {
        \\"key\\": \\"value\\"
      } ✓ [DEBUG] debug info"
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

  test('renders colored text token correctly', async () => {
    const item = {
      color: {
        text: 'Success message',
        color: 'green' as const,
      },
    }

    const {lastFrame} = render(<TokenizedText item={item} />)
    expect(lastFrame()).toContain('Success message')
  })

  test('renders json token correctly', async () => {
    const item = {
      json: {name: 'test', value: 42},
    }

    const {lastFrame} = render(<TokenizedText item={item} />)
    expect(lastFrame()).toContain('test')
    expect(lastFrame()).toContain('42')
  })

  test('renders icon token correctly', async () => {
    const item = {
      icon: 'success' as const,
    }

    const {lastFrame} = render(<TokenizedText item={item} />)
    expect(lastFrame()).toContain('✓')
  })

  test('renders debug token correctly', async () => {
    const item = {
      debug: 'debug information',
    }

    const {lastFrame} = render(<TokenizedText item={item} />)
    expect(lastFrame()).toContain('[DEBUG] debug information')
  })
})
