import ConcurrentOutput from './ConcurrentOutput.js'
import {render} from '../../../../testing/ink.js'
import {Signal} from '../../../../abort.js'
import {describe, expect, test} from 'vitest'
import AbortController from 'abort-controller'
import React from 'react'
import {Writable} from 'node:stream'

describe('ConcurrentOutput', async () => {
  test('it allows to run a callback when ctrl+c is pressed', async () => {
    // Given
    const neverEndingPromise = new Promise<void>(function (_resolve, _reject) {})

    const neverEndingProcess = {
      prefix: 'never-ending-process',
      action: async (_stdout: Writable, _stderr: Writable, _signal: Signal) => {
        await neverEndingPromise
      },
    }

    const onCtrlC = async (stdout: Writable) => {
      stdout.write('ctrl-c pressed')
    }

    // When
    const {waitUntilExit, stdin, frames} = render(
      <ConcurrentOutput processes={[neverEndingProcess]} abortController={new AbortController()} onCtrlC={onCtrlC} />,
    )

    setInterval(() => {
      stdin.write('\u0003')
    }, 100)

    await waitUntilExit()

    // Then
    expect(frames).toMatchInlineSnapshot(`
      [
        "",
        "ctrl-c pressed",
        "",
      ]
    `)
  })
})
