import ConcurrentOutput from './ConcurrentOutput.js'
import {render} from '../../../../testing/ink.js'
import {Signal} from '../../../../abort.js'
import {describe, expect, test} from 'vitest'
import AbortController from 'abort-controller'
import React from 'react'
import stripAnsi from 'strip-ansi'
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

  test('renders a stream of concurrent outputs from sub-processes', async () => {
    // When
    let backendPromiseResolve: () => void

    const backendPromise = new Promise<void>(function (resolve, _reject) {
      backendPromiseResolve = resolve
    })

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: Signal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        backendPromiseResolve()
      },
    }

    const frontendProcess = {
      prefix: 'frontend',
      action: async (stdout: Writable, _stderr: Writable, _signal: Signal) => {
        await backendPromise

        stdout.write('first frontend message')
        stdout.write('second frontend message')
        stdout.write('third frontend message')
      },
    }

    const {waitUntilExit, lastFrame} = render(
      <ConcurrentOutput processes={[backendProcess, frontendProcess]} abortController={new AbortController()} />,
    )

    await waitUntilExit()

    const output = stripAnsi(lastFrame() ?? '').replace(/\d/g, '0')

    // Then
    expect(output).toMatchInlineSnapshot(`
      "0000-00-00 00:00:00 | backend  | first backend message
      0000-00-00 00:00:00 | backend  | second backend message
      0000-00-00 00:00:00 | backend  | third backend message
      0000-00-00 00:00:00 | frontend | first frontend message
      0000-00-00 00:00:00 | frontend | second frontend message
      0000-00-00 00:00:00 | frontend | third frontend message
      "
    `)
  })
})
