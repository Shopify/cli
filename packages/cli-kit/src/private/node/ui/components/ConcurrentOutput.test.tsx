import ConcurrentOutput from './ConcurrentOutput.js'
import {Signal} from '../../../../abort.js'
import {unstyled} from '../../../../output.js'
import {getLastFrameAfterUnmount} from '../../../../testing/ui.js'
import React from 'react'
import {describe, expect, test} from 'vitest'
import {AbortController} from 'abort-controller'
import {render} from 'ink-testing-library'
import {Writable} from 'node:stream'

describe('ConcurrentOutput', () => {
  test('renders a stream of concurrent outputs from sub-processes', async () => {
    // Given
    let backendPromiseResolve: () => void
    let frontendPromiseResolve: () => void

    const backendPromise = new Promise<void>(function (resolve, _reject) {
      backendPromiseResolve = resolve
    })

    const frontendPromise = new Promise<void>(function (resolve, _reject) {
      frontendPromiseResolve = resolve
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

        frontendPromiseResolve()
      },
    }
    // When

    const renderInstance = render(
      <ConcurrentOutput processes={[backendProcess, frontendProcess]} abortController={new AbortController()} />,
    )

    // wait for all output to be rendered
    await frontendPromise

    // Then
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
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
