import {Alert} from './Alert.js'
import {unstyled} from '../../../../output.js'
import {describe, expect, test} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

describe('Alert', async () => {
  test('renders correctly with all the options', async () => {
    const options = {
      headline: [{userInput: 'my-app'}, 'initialized and ready to build.'],
      body: ['You can find the build files in the ', {filePath: 'dist'}, 'folder.'],
      nextSteps: [
        [
          'Run',
          {
            command: 'cd santorini-goods',
          },
        ],
        [
          'To preview your project, run',
          {
            command: 'npm app dev',
          },
        ],
        [
          'To add extensions, run',
          {
            command: 'npm generate extension',
          },
        ],
      ],
      reference: [
        [
          'Run',
          {
            command: 'npm shopify help',
          },
        ],
        [
          // testing link wrapping behavior
          "Press 'return' to open the really amazing and clean",
          {
            link: {
              label: 'dev docs',
              url: 'https://shopify.dev',
            },
          },
        ],
      ],
      link: {
        label: 'Link',
        url: 'https://shopify.com',
      },
      customSections: [
        {
          title: 'Custom section',
          body: {
            list: {
              items: ['Item 1', 'Item 2', 'Item 3'],
            },
          },
        },
        {
          title: 'Custom section 2',
          body: {
            list: {
              items: ['Item 1', 'Item 2', 'Item 3'],
            },
          },
        },
      ],
    }

    const {lastFrame} = render(<Alert type="info" {...options} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "
      ╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  my-app initialized and ready to build.                                      │
      │                                                                              │
      │  You can find the build files in the  \\"dist\\" folder.                         │
      │                                                                              │
      │  Next steps                                                                  │
      │    • Run \`cd santorini-goods\`                                                │
      │    • To preview your project, run \`npm app dev\`                              │
      │    • To add extensions, run \`npm generate extension\`                         │
      │                                                                              │
      │  Reference                                                                   │
      │    • Run \`npm shopify help\`                                                  │
      │    • Press 'return' to open the really amazing and clean dev docs (          │
      │      https://shopify.dev )                                                   │
      │                                                                              │
      │  Link ( https://shopify.com )                                                │
      │                                                                              │
      │  Custom section                                                              │
      │    • Item 1                                                                  │
      │    • Item 2                                                                  │
      │    • Item 3                                                                  │
      │                                                                              │
      │  Custom section 2                                                            │
      │    • Item 1                                                                  │
      │    • Item 2                                                                  │
      │    • Item 3                                                                  │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('renders correctly with only required options', async () => {
    const options = {
      headline: 'Title',
    }

    const {lastFrame} = render(<Alert type="info" {...options} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "
      ╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Title                                                                       │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })
})
