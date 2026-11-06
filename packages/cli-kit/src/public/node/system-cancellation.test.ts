import {captureOutputWithExitCode, exec} from './system.js'
import {AbortController} from './abort.js'
import {ExternalError} from './error.js'
import {fileExists, inTemporaryDirectory} from './fs.js'
import {joinPath} from './path.js'
import {expect, test} from 'vitest'
import {Writable} from 'stream'
import {getEventListeners} from 'events'

test('does not start a command when its signal is already aborted', async () => {
  await inTemporaryDirectory(async (directory) => {
    const controller = new AbortController()
    const markerPath = joinPath(directory, 'started')
    controller.abort()

    await exec(process.execPath, ['-e', "require('node:fs').writeFileSync(process.argv[1], 'started')", markerPath], {
      signal: controller.signal,
    })

    await expect(fileExists(markerPath)).resolves.toBe(false)
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  })
})

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
  let childPid = 0
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      childPid = Number(chunk.toString())
      controller.abort()
      callback()
    },
  })
  try {
    await expect(
      captureOutputWithExitCode(
        process.execPath,
        ['-e', 'process.stdout.write(String(process.pid)); setInterval(() => {}, 1000)'],
        {
          stdout,
          signal: controller.signal,
        },
      ),
    ).rejects.toBeInstanceOf(ExternalError)
    expect(controller.signal.aborted).toBe(true)
    expect(childPid).toBeGreaterThan(0)
    expect(() => process.kill(childPid, 0)).toThrow()
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  } finally {
    controller.abort()
    stdout.end()
  }
})

test('does not start a captured command when its signal is already aborted', async () => {
  await inTemporaryDirectory(async (directory) => {
    const controller = new AbortController()
    const markerPath = joinPath(directory, 'started')
    controller.abort()

    await expect(
      captureOutputWithExitCode(
        process.execPath,
        ['-e', "require('node:fs').writeFileSync(process.argv[1], 'started')", markerPath],
        {signal: controller.signal},
      ),
    ).rejects.toBeInstanceOf(ExternalError)

    await expect(fileExists(markerPath)).resolves.toBe(false)
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  })
})

test.each([0, 1])('removes the capture abort listener after exit code %s', async (exitCode) => {
  const controller = new AbortController()

  await expect(
    captureOutputWithExitCode(process.execPath, ['-e', `process.exit(${exitCode})`], {signal: controller.signal}),
  ).resolves.toMatchObject({exitCode})

  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
})

test('removes the capture abort listener after a startup failure', async () => {
  const controller = new AbortController()

  await expect(
    captureOutputWithExitCode('nonexistent-capture-command', [], {signal: controller.signal}),
  ).rejects.toBeInstanceOf(ExternalError)

  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
})

test.runIf(process.platform !== 'win32')('waits for capture cleanup before cancellation returns', async () => {
  await inTemporaryDirectory(async (directory) => {
    const controller = new AbortController()
    const cleanupPath = joinPath(directory, 'cleanup')
    let childPid = 0
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        childPid = Number(chunk.toString())
        controller.abort()
        callback()
      },
    })
    const script = `
      process.on('SIGTERM', () => setTimeout(() => {
        require('node:fs').writeFileSync(process.argv[1], 'cleanup complete');
        process.exit(0);
      }, 300));
      process.stdout.write(String(process.pid));
      setInterval(() => {}, 1000);
    `

    try {
      await expect(
        captureOutputWithExitCode(process.execPath, ['-e', script, cleanupPath], {
          stdout,
          signal: controller.signal,
        }),
      ).rejects.toBeInstanceOf(ExternalError)

      await expect(fileExists(cleanupPath)).resolves.toBe(true)
      expect(() => process.kill(childPid, 0)).toThrow()
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
    } finally {
      controller.abort()
      stdout.end()
      if (childPid) await expect.poll(() => fileExists(cleanupPath), {timeout: 3000}).toBe(true)
    }
  })
})
