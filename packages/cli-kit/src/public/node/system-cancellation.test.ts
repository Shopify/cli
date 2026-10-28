import {captureOutputWithExitCode, exec} from './system.js'
import {AbortController} from './abort.js'
import {ExternalError} from './error.js'
import {expect, test} from 'vitest'
import {Writable} from 'stream'
import {getEventListeners} from 'events'

test('does not accumulate abort listeners across repeated commands', async () => {
  const controller = new AbortController()

  for (let index = 0; index < 12; index++) {
    // eslint-disable-next-line no-await-in-loop -- Rebuilds reuse the signal sequentially.
    await exec(process.execPath, ['-e', ''], {signal: controller.signal})
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  }
})

test('removes the abort listener when a command fails', async () => {
  const controller = new AbortController()

  await expect(exec(process.execPath, ['-e', 'process.exit(1)'], {signal: controller.signal})).rejects.toBeInstanceOf(
    ExternalError,
  )

  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
})

test('removes the abort listener when a custom error handler throws', async () => {
  const controller = new AbortController()
  const error = new Error('Custom handler failed')

  await expect(
    exec(process.execPath, ['-e', 'process.exit(1)'], {
      signal: controller.signal,
      externalErrorHandler: async () => {
        throw error
      },
    }),
  ).rejects.toBe(error)

  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
})

test('aborts a running command and removes its abort listener', async () => {
  const controller = new AbortController()
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      controller.abort()
      callback()
    },
  })

  try {
    await expect(
      exec(process.execPath, ['-e', "process.stdout.write('ready'); setInterval(() => {}, 1000)"], {
        stdout,
        signal: controller.signal,
      }),
    ).resolves.toBeUndefined()
    expect(controller.signal.aborted).toBe(true)
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  } finally {
    controller.abort()
    stdout.end()
  }
})

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
