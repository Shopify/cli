import {FatalError} from './FatalError.js'
import {renderString} from '../../ui.js'
import {unstyled} from '../../../../output.js'
import {Abort, Bug, ExternalError} from '../../../../error.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('FatalError', async () => {
  test('renders correctly with a just a message and tryMessage', async () => {
    const error = new Abort('test', 'try this')
    const {output} = renderString(<FatalError error={error} />)

    expect(unstyled(output!)).toMatchInlineSnapshot(`
      "
      ╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  test                                                                        │
      │                                                                              │
      │  try this                                                                    │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('renders correctly with a message and a stack', async () => {
    const error = new Bug('Unexpected error')
    error.stack = `
      Error: Unexpected error
          at Module._compile (internal/modules/cjs/loader.js:1137:30)
          at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)
          at Module.load (internal/modules/cjs/loader.js:985:32)
          at Function.Module._load (internal/modules/cjs/loader.js:878:14)
    `

    const {output} = renderString(<FatalError error={error} />)

    expect(unstyled(output!)).toMatchInlineSnapshot(`
      "
      ╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Unexpected error                                                            │
      │                                                                              │
      │  To investigate the issue, examine this stack trace:                         │
      │    at _compile (internal/modules/cjs/loader.js:1137)                         │
      │    at js (internal/modules/cjs/loader.js:1157)                               │
      │    at load (internal/modules/cjs/loader.js:985)                              │
      │    at _load (internal/modules/cjs/loader.js:878)                             │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('renders correctly with a message, a stack, and next steps', async () => {
    const error = new Bug('Unexpected error')
    error.stack = `
      Error: Unexpected error
          at Module._compile (internal/modules/cjs/loader.js:1137:30)
          at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)
          at Module.load (internal/modules/cjs/loader.js:985:32)
          at Function.Module._load (internal/modules/cjs/loader.js:878:14)
    `

    error.nextSteps = [
      [
        'Have you',
        {
          link: {
            label: 'created a Shopify Partners organization',
            url: 'https://partners.shopify.com/signup',
          },
        },
        {
          char: '?',
        },
      ],
      'Have you confirmed your accounts from the emails you received?',
      [
        'Need to connect to a different App or organization? Run the command again with',
        {
          command: '--reset',
        },
      ],
    ]

    const {output} = renderString(<FatalError error={error} />)

    expect(unstyled(output!)).toMatchInlineSnapshot(`
      "
      ╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Unexpected error                                                            │
      │                                                                              │
      │  Next steps                                                                  │
      │    • Have you created a Shopify Partners organization (                      │
      │      https://partners.shopify.com/signup )?                                  │
      │    • Have you confirmed your accounts from the emails you received?          │
      │    • Need to connect to a different App or organization? Run the command     │
      │      again with \`--reset\`                                                    │
      │                                                                              │
      │  To investigate the issue, examine this stack trace:                         │
      │    at _compile (internal/modules/cjs/loader.js:1137)                         │
      │    at js (internal/modules/cjs/loader.js:1157)                               │
      │    at load (internal/modules/cjs/loader.js:985)                              │
      │    at _load (internal/modules/cjs/loader.js:878)                             │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('renders correctly an external error', async () => {
    const error = new ExternalError('Unexpected error', 'yarn', ['install'])

    const {output} = renderString(<FatalError error={error} />)

    expect(unstyled(output!)).toMatchInlineSnapshot(`
      "
      ── external error ──────────────────────────────────────────────────────────────

      Error coming from \`yarn install\`

      Unexpected error

      ────────────────────────────────────────────────────────────────────────────────
      "
    `)
  })
})
