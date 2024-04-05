import {Alert} from './Alert.js'
import {unstyled} from '../../../../public/node/output.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('Alert', async () => {
  test('renders correctly with all the options', async () => {
    const options = {
      headline: [{userInput: 'my-app'}, 'initialized and ready to build.'],
      body: ['You can find the build files in the', {filePath: 'dist'}, 'folder.'],
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
        url: 'https://www.google.com/search?q=jh56t9l34kpo35tw8s28hn7s9s2xvzla01d8cn6j7yq&rlz=1C1GCEU_enUS832US832&oq=jh56t9l34kpo35tw8s28hn7s9s2xvzla01d8cn6j7yq&aqs=chrome.0.35i39l2j0l4j46j69i60.2711j0j7&sourceid=chrome&ie=UTF-8',
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
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  my-app initialized and ready to build.                                      │
      │                                                                              │
      │  You can find the build files in the dist folder.                            │
      │                                                                              │
      │  Next steps                                                                  │
      │    • Run \`cd santorini-goods\`                                                │
      │    • To preview your project, run \`npm app dev\`                              │
      │    • To add extensions, run \`npm generate extension\`                         │
      │                                                                              │
      │  Reference                                                                   │
      │    • Run \`npm shopify help\`                                                  │
      │    • Press 'return' to open the really amazing and clean dev docs [1]        │
      │                                                                              │
      │  Link [2]                                                                    │
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
      [1] https://shopify.dev
      [2] https://www.google.com/search?q=jh56t9l34kpo35tw8s28hn7s9s2xvzla01d8cn6j7yq&rlz=1C1GCEU_enUS832U
      S832&oq=jh56t9l34kpo35tw8s28hn7s9s2xvzla01d8cn6j7yq&aqs=chrome.0.35i39l2j0l4j46j69i60.2711j0j7&sourc
      eid=chrome&ie=UTF-8
      "
    `)
  })

  test('allows passing just a body', async () => {
    const options = {
      body: 'Title',
    }

    const {lastFrame} = render(<Alert type="info" {...options} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Title                                                                       │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('has the headline in bold', async () => {
    const options = {
      headline: 'Title.',
    }

    const {lastFrame} = render(<Alert type="info" {...options} />)

    expect(lastFrame()).toMatchInlineSnapshot(`
      "[2m╭─[22m info [2m───────────────────────────────────────────────────────────────────────╮[22m
      [2m│[22m                                                                              [2m│[22m
      [2m│[22m  [1mTitle.[22m                                                                      [2m│[22m
      [2m│[22m                                                                              [2m│[22m
      [2m╰──────────────────────────────────────────────────────────────────────────────╯[22m
      "
    `)
  })
})
