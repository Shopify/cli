import {captureOutputWithExitCode} from './system.js'
import {AbortController} from './abort.js'
import {ExternalError} from './error.js'
import {expect, test} from 'vitest'
import {Writable} from 'stream'

test('aborts a captured process and waits for its exit', async () => {
  const controller = new AbortController()
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      controller.abort()
      callback()
    },
  })
  try {
    await expect(
      captureOutputWithExitCode(
        process.execPath,
        ['-e', "process.stdout.write('ready'); setInterval(() => {}, 1000)"],
        {
          stdout,
          signal: controller.signal,
        },
      ),
    ).rejects.toBeInstanceOf(ExternalError)
    expect(controller.signal.aborted).toBe(true)
  } finally {
    controller.abort()
    stdout.end()
  }
})
