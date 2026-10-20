import {
  acquireDevInstance,
  DEV_INSTANCE_ALREADY_RUNNING_CODE,
  devInstancePaths,
  isProcessAlive,
  listDevInstances,
  readDevInstance,
} from './dev-instance.js'
import {AbortError} from './error.js'
import {fileExists, inTemporaryDirectory, mkdir, readFile, rmdir, writeFile} from './fs.js'
import {
  getConcurrentOutputContext,
  useConcurrentOutputContext,
} from '../../private/node/ui/components/ConcurrentOutput.js'
import {describe, expect, test, vi} from 'vitest'
import {Writable} from 'stream'
import {utimes} from 'fs/promises'

const DEAD_PID = 2 ** 22 + 12345

function collectingStream() {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString())
      callback()
    },
  })
  return {stream, chunks}
}

async function readLog(path: string) {
  const content = await readFile(path)
  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

describe('acquireDevInstance', () => {
  test('writes identical JSONL bytes to the log and an output stream without changing supplied timestamps', async () => {
    await inTemporaryDirectory(async (directory) => {
      const output = collectingStream()
      const instance = await acquireDevInstance({command: 'app dev', directory, logOutput: output.stream})
      await Promise.all([
        instance.log({timestamp: '2026-10-20T09:00:00Z', source: 'app dev', level: 'info', message: 'Setup'}),
        instance.log({source: 'web', message: 'Warning'}),
      ])
      await instance.release()
      expect(output.chunks.join('')).toBe(await readFile(instance.paths.logFile))
      expect(JSON.parse(output.chunks[0]!)).toEqual({
        timestamp: '2026-10-20T09:00:00Z',
        source: 'app dev',
        level: 'info',
        message: 'Setup',
      })
      expect(output.stream.writableEnded).toBe(false)
    })
  })

  test('aborts and releases ownership when the mirror fails', async () => {
    await inTemporaryDirectory(async (directory) => {
      let finishWrite: ((error?: Error | null) => void) | undefined
      const output = new Writable({
        write: (_chunk, _encoding, callback) => {
          finishWrite = callback
        },
      })
      const instance = await acquireDevInstance({command: 'app dev', directory, logOutput: output})
      const failure = new Error('Output failed')
      const writing = instance.log({source: 'web', message: 'Server ready'})
      const rejected = expect(writing).rejects.toBe(failure)
      await vi.waitFor(() => expect(finishWrite).toBeDefined())
      finishWrite?.(failure)
      await rejected
      expect(instance.abortSignal.aborted).toBe(true)
      await instance.release()
      await expect(readDevInstance({command: 'app dev', directory})).resolves.toBeUndefined()
    })
  })

  test('describes the instance in .shopify/dev and releases it', async () => {
    await inTemporaryDirectory(async (directory) => {
      // When
      const instance = await acquireDevInstance({
        command: 'app dev',
        directory,
        key: 'shopify.app.toml',
        details: {store: 'my-store.myshopify.com'},
      })

      // Then
      const paths = devInstancePaths({command: 'app dev', directory, key: 'shopify.app.toml'})
      expect(paths.infoFile).toMatch(/\.shopify\/dev\/app-dev-shopify\.app\.toml\.json$/)
      const info = JSON.parse(await readFile(paths.infoFile))
      expect(info).toMatchObject({
        schemaVersion: 1,
        sessionId: instance.info.sessionId,
        command: 'app dev',
        key: 'shopify.app.toml',
        pid: process.pid,
        status: 'starting',
        directory,
        logFile: paths.logFile,
        details: {store: 'my-store.myshopify.com'},
      })
      await expect(fileExists(paths.lockFile)).resolves.toBe(true)
      await expect(readDevInstance({command: 'app dev', directory, key: 'shopify.app.toml'})).resolves.toMatchObject({
        pid: process.pid,
      })

      // When
      await instance.release()
      await instance.release()

      // Then
      await expect(fileExists(paths.infoFile)).resolves.toBe(false)
      await expect(fileExists(paths.lockFile)).resolves.toBe(false)
      await expect(readDevInstance({command: 'app dev', directory, key: 'shopify.app.toml'})).resolves.toBeUndefined()
    })
  })

  test('refuses to start while another live instance holds the lock', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Given
      const running = await acquireDevInstance({command: 'app dev', directory, details: {previewUrl: 'https://x'}})

      // When
      const error = await acquireDevInstance({command: 'app dev', directory}).catch((error: unknown) => error)

      // Then
      expect(error).toBeInstanceOf(AbortError)
      expect((error as AbortError).message).toContain('Another `shopify app dev` is already running')
      expect((error as AbortError).code).toBe(DEV_INSTANCE_ALREADY_RUNNING_CODE)
      expect((error as AbortError).details).toEqual({instance: running.info})
      await running.release()
    })
  })

  test('takes over a lock left behind by a process that no longer exists', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Given
      const paths = devInstancePaths({command: 'theme dev', directory})
      await mkdir(paths.lockFile)
      await writeFile(paths.infoFile, JSON.stringify({pid: DEAD_PID, logFile: paths.logFile, details: {}}))

      // When
      const instance = await acquireDevInstance({command: 'theme dev', directory})

      // Then
      expect(instance.info.pid).toBe(process.pid)
      await instance.release()
    })
  })

  test('does not take over a live owner with a stale heartbeat', async () => {
    await inTemporaryDirectory(async (directory) => {
      const paths = devInstancePaths({command: 'app dev', directory})
      await mkdir(paths.lockFile)
      const oneMinuteAgo = new Date(Date.now() - 60_000)
      await utimes(paths.lockFile, oneMinuteAgo, oneMinuteAgo)
      await writeFile(paths.infoFile, JSON.stringify({pid: process.ppid, logFile: paths.logFile, details: {}}))

      // When
      await expect(acquireDevInstance({command: 'app dev', directory})).rejects.toMatchObject({
        code: DEV_INSTANCE_ALREADY_RUNNING_CODE,
      })
    })
  })

  test('only one contender recovers an abandoned instance', async () => {
    await inTemporaryDirectory(async (directory) => {
      const paths = devInstancePaths({command: 'app dev', directory})
      await mkdir(paths.lockFile)
      await writeFile(paths.infoFile, JSON.stringify({pid: DEAD_PID, details: {}}))
      const attempts = await Promise.allSettled(
        Array.from({length: 8}, async () => acquireDevInstance({command: 'app dev', directory})),
      )
      const owners = attempts.flatMap((attempt) => (attempt.status === 'fulfilled' ? [attempt.value] : []))
      try {
        expect(owners).toHaveLength(1)
        await expect(readDevInstance({command: 'app dev', directory})).resolves.toMatchObject({
          sessionId: owners[0]?.info.sessionId,
        })
        for (const attempt of attempts) {
          if (attempt.status === 'rejected') expect(attempt.reason.code).toBe(DEV_INSTANCE_ALREADY_RUNNING_CODE)
        }
      } finally {
        await Promise.all(owners.map((owner) => owner.release()))
      }
    })
  })

  test('requires explicit cleanup of an interrupted startup', async () => {
    await inTemporaryDirectory(async (directory) => {
      const identity = {command: 'app dev', directory}
      const paths = devInstancePaths(identity)
      const startupLock = `${paths.lockFile}.acquire`
      await mkdir(startupLock)
      await expect(acquireDevInstance(identity)).rejects.toMatchObject({
        code: DEV_INSTANCE_ALREADY_RUNNING_CODE,
        message: expect.stringContaining('a previous startup was interrupted'),
      })
      await expect(fileExists(startupLock)).resolves.toBe(true)
      await expect(fileExists(paths.lockFile)).resolves.toBe(false)
      await rmdir(startupLock)
      const instance = await acquireDevInstance(identity)
      await instance.release()
      await expect(fileExists(startupLock)).resolves.toBe(false)
    })
  })

  test('does not remove another session record or lock during release', async () => {
    await inTemporaryDirectory(async (directory) => {
      const instance = await acquireDevInstance({command: 'app dev', directory})
      const replacement = {...instance.info, sessionId: 'replacement'}
      await writeFile(instance.paths.infoFile, JSON.stringify(replacement))
      await instance.release()
      expect(JSON.parse(await readFile(instance.paths.infoFile))).toEqual(replacement)
      await expect(fileExists(instance.paths.lockFile)).resolves.toBe(true)
    })
  })

  test('refuses to start while the lock is fresh but not described yet', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Given
      const paths = devInstancePaths({command: 'app dev', directory})
      await mkdir(paths.lockFile)

      // When
      const error = await acquireDevInstance({command: 'app dev', directory}).catch((error: unknown) => error)

      // Then
      expect((error as AbortError).message).toContain('is starting for this project')
      expect((error as AbortError).code).toBe(DEV_INSTANCE_ALREADY_RUNNING_CODE)
    })
  })

  test('aborts when its lock is removed', async () => {
    await inTemporaryDirectory(async (directory) => {
      vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']})
      const instance = await acquireDevInstance({command: 'app dev', directory})
      try {
        await rmdir(instance.paths.lockFile)
        await vi.advanceTimersByTimeAsync(15_000)
        await vi.waitFor(() => expect(instance.abortSignal.aborted).toBe(true))
        expect(instance.abortSignal.reason).toBeInstanceOf(AbortError)
      } finally {
        await instance.release()
        vi.useRealTimers()
      }
    })
  })

  test('keeps instances with different keys apart', async () => {
    await inTemporaryDirectory(async (directory) => {
      // When
      const production = await acquireDevInstance({command: 'app dev', directory, key: 'shopify.app.toml'})
      const staging = await acquireDevInstance({command: 'app dev', directory, key: 'shopify.app.staging.toml'})

      // Then
      const instances = await listDevInstances(directory)
      expect(instances.map((instance) => instance.key).sort()).toEqual(['shopify.app.staging.toml', 'shopify.app.toml'])
      await production.release()
      await staging.release()
      await expect(listDevInstances(directory)).resolves.toEqual([])
    })
  })

  test('persists updates to the instance description', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Given
      const instance = await acquireDevInstance({command: 'app dev', directory, details: {store: 'a'}})

      // When
      await Promise.all([
        instance.update({status: 'running'}),
        instance.update({details: {previewUrl: 'https://preview'}}),
      ])

      // Then
      const info = await readDevInstance({command: 'app dev', directory})
      expect(info).toMatchObject({status: 'running', details: {store: 'a', previewUrl: 'https://preview'}})
      await instance.release()
    })
  })

  test('can save status again after a write fails', async () => {
    await inTemporaryDirectory(async (directory) => {
      const instance = await acquireDevInstance({command: 'app dev', directory})
      const temporaryFile = `${instance.paths.infoFile}.${instance.info.sessionId}.tmp`
      try {
        await mkdir(temporaryFile)
        await expect(instance.update({details: {sequence: 1}})).rejects.toThrow()
        await rmdir(temporaryFile)
        await instance.update({details: {sequence: 2}})
        expect(JSON.parse(await readFile(instance.paths.infoFile))).toHaveProperty('details.sequence', 2)
      } finally {
        await rmdir(temporaryFile, {force: true})
        await instance.release()
      }
    })
  })

  test.each(['infoFile', 'logFile'] as const)('releases startup resources when %s cannot be written', async (file) => {
    await inTemporaryDirectory(async (directory) => {
      const paths = devInstancePaths({command: 'app dev', directory})
      await mkdir(paths[file])
      const exitListeners = process.listenerCount('exit')
      await expect(acquireDevInstance({command: 'app dev', directory})).rejects.toThrow()
      await expect(fileExists(paths.lockFile)).resolves.toBe(false)
      await expect(fileExists(`${paths.lockFile}.acquire`)).resolves.toBe(false)
      expect(process.listenerCount('exit')).toBe(exitListeners)
      await rmdir(paths[file])
      const restarted = await acquireDevInstance({command: 'app dev', directory})
      await restarted.log({source: 'web', message: 'recovered'})
      await restarted.release()
      await expect(readLog(paths.logFile)).resolves.toEqual([expect.objectContaining({message: 'recovered'})])
    })
  })
})

describe('DevInstance log', () => {
  test('records complete string messages immediately while assembling byte output into lines', async () => {
    await inTemporaryDirectory(async (directory) => {
      const instance = await acquireDevInstance({command: 'app dev', directory})
      const chunks: Buffer[] = []
      const target = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk))
          callback()
        },
      })
      const output = instance.tee(target, {source: 'web', stringWritesAreMessages: true})
      const write = (chunk: string | Buffer) =>
        new Promise<void>((resolve, reject) => {
          output.write(chunk, (error) => (error ? reject(error) : resolve()))
        })
      try {
        await write('Bundling extension...')
        await expect(readLog(instance.paths.logFile)).resolves.toEqual([
          {timestamp: expect.any(String), source: 'web', message: 'Bundling extension...'},
        ])
        await write('Extension built')
        const bytes = Buffer.from('café\n')
        await write(bytes.subarray(0, 4))
        await write(bytes.subarray(4))
        await instance.release()
        expect(Buffer.concat(chunks).toString()).toBe('Bundling extension...Extension builtcafé\n')
        expect((await readLog(instance.paths.logFile)).map(({message}) => message)).toEqual([
          'Bundling extension...',
          'Extension built',
          'café',
        ])
      } finally {
        await instance.release()
      }
    })
  })

  test('preserves extension sources in queued terminal writes and log records', async () => {
    await inTemporaryDirectory(async (directory) => {
      const instance = await acquireDevInstance({command: 'app dev', directory})
      const terminal: {source: string | undefined; message: string}[] = []
      let resume: () => void = () => {}
      const target = new Writable({
        write(chunk, _encoding, callback) {
          terminal.push({source: getConcurrentOutputContext()?.outputPrefix, message: chunk.toString()})
          if (terminal.length === 1) resume = callback
          else callback()
        },
      })
      const output = instance.tee(target, {source: 'app-preview'})
      try {
        useConcurrentOutputContext({outputPrefix: 'discount'}, () => {
          output.write('Building discount...\n')
          output.write('Finished discount\n')
        })
        useConcurrentOutputContext({outputPrefix: 'admin-action'}, () => output.write('Bundling action...\n'))
        useConcurrentOutputContext({outputPrefix: 'app-config'}, () => output.end('Configuration accepted'))
        resume()
        await instance.release()
        expect(terminal).toEqual([
          {source: 'discount', message: 'Building discount...\n'},
          {source: 'discount', message: 'Finished discount\n'},
          {source: 'admin-action', message: 'Bundling action...\n'},
          {source: 'app-config', message: 'Configuration accepted'},
        ])
        const entries = await readLog(instance.paths.logFile)
        expect(entries.map(({source, message}) => ({source, message}))).toEqual([
          {source: 'discount', message: 'Building discount...'},
          {source: 'discount', message: 'Finished discount'},
          {source: 'admin-action', message: 'Bundling action...'},
          {source: 'app-config', message: 'Configuration accepted'},
        ])
      } finally {
        await instance.release()
      }
    })
  })

  test('keeps incomplete messages from different sources separate', async () => {
    await inTemporaryDirectory(async (directory) => {
      const instance = await acquireDevInstance({command: 'app dev', directory})
      const output = instance.tee(collectingStream().stream, {source: 'app-preview'})
      useConcurrentOutputContext({outputPrefix: 'discount'}, () => output.write('first'))
      useConcurrentOutputContext({outputPrefix: 'admin-action'}, () => output.write('second'))
      await instance.release()
      expect((await readLog(instance.paths.logFile)).map(({source, message}) => ({source, message}))).toEqual([
        {source: 'discount', message: 'first'},
        {source: 'admin-action', message: 'second'},
      ])
    })
  })

  test('tees process output into a JSON Lines log without ANSI styling', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Given
      const instance = await acquireDevInstance({command: 'app dev', directory})
      const {stream: target, chunks} = collectingStream()
      const stdout = instance.tee(target, {source: 'web'})

      // When
      stdout.write('\u001b[32mready\u001b[39m in 20ms\npartial ')
      stdout.write('line\n\n')
      await new Promise<void>((resolve) => stdout.end(resolve))
      await instance.log({source: 'app dev', level: 'info', message: 'Preview URL: https://preview'})
      await instance.release()

      // Then
      expect(chunks.join('')).toBe('\u001b[32mready\u001b[39m in 20ms\npartial line\n\n')
      const entries = await readLog(instance.paths.logFile)
      expect(entries).toEqual([
        {timestamp: expect.any(String), source: 'web', message: 'ready in 20ms'},
        {timestamp: expect.any(String), source: 'web', message: 'partial line'},
        {timestamp: expect.any(String), source: 'app dev', level: 'info', message: 'Preview URL: https://preview'},
      ])
      expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    })
  })

  test('flushes a split UTF-8 line on release without requiring the source to end', async () => {
    await inTemporaryDirectory(async (directory) => {
      const instance = await acquireDevInstance({command: 'app dev', directory})
      const output = instance.tee(collectingStream().stream, {source: 'web'})
      const bytes = Buffer.from('café')
      output.write(bytes.subarray(0, 4))
      output.write(bytes.subarray(4))
      await instance.release()
      await expect(readLog(instance.paths.logFile)).resolves.toEqual([
        {timestamp: expect.any(String), source: 'web', message: 'café'},
      ])
    })
  })

  test('starts each run with an empty log', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Given
      const first = await acquireDevInstance({command: 'app dev', directory})
      await first.log({source: 'app dev', message: 'first run'})
      await first.release()

      // When
      const second = await acquireDevInstance({command: 'app dev', directory})
      expect(second.info.sessionId).not.toBe(first.info.sessionId)
      await second.log({source: 'app dev', message: 'second run'})
      await second.release()

      // Then
      const entries = await readLog(second.paths.logFile)
      expect(entries.map((entry) => entry.message)).toEqual(['second run'])
    })
  })

  test('holds back the producer until the destination accepts its output', async () => {
    await inTemporaryDirectory(async (directory) => {
      const instance = await acquireDevInstance({command: 'app dev', directory})
      let accept: () => void = () => {}
      const target = new Writable({
        write(_chunk, _encoding, callback) {
          accept = () => {
            accept = () => {}
            callback()
          }
        },
      })
      const output = instance.tee(target, {source: 'web'})
      let written = false
      const completed = new Promise<void>((resolve, reject) => {
        const available = output.write(`${'x'.repeat(output.writableHighWaterMark)}\n`, (error) => {
          if (error) return reject(error)
          written = true
          resolve()
        })
        expect(available).toBe(false)
      })
      try {
        expect(written).toBe(false)
        accept()
        await completed
        await instance.release()
        await expect(readLog(instance.paths.logFile)).resolves.toHaveLength(1)
        expect(target.listenerCount('error')).toBe(0)
      } finally {
        accept()
        await instance.release()
      }
    })
  })

  test('reports destination errors and releases the instance after output fails', async () => {
    await inTemporaryDirectory(async (directory) => {
      const instance = await acquireDevInstance({command: 'app dev', directory})
      const target = new Writable({
        write(_chunk, _encoding, callback) {
          callback(new Error('Output failed'))
        },
      })
      const output = instance.tee(target, {source: 'web'})
      await expect(
        new Promise<void>((resolve, reject) => {
          output.write('message\n', (error) => (error ? reject(error) : resolve()))
        }),
      ).rejects.toThrow('Output failed')
      await expect(instance.release()).rejects.toThrow('Output failed')
      expect(instance.abortSignal.aborted).toBe(true)
      await expect(fileExists(instance.paths.infoFile)).resolves.toBe(false)
      await expect(fileExists(instance.paths.lockFile)).resolves.toBe(false)
    })
  })
})

describe('isProcessAlive', () => {
  test('detects the current process and a missing one', () => {
    expect(isProcessAlive(process.pid)).toBe(true)
    expect(isProcessAlive(DEAD_PID)).toBe(false)
    expect(isProcessAlive(0)).toBe(false)
  })
})
