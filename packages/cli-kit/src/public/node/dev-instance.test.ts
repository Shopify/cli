import {
  acquireDevInstance,
  DEV_INSTANCE_ALREADY_RUNNING_CODE,
  devInstancePaths,
  isProcessAlive,
  listDevInstances,
  readDevInstance,
} from './dev-instance.js'
import {AbortError} from './error.js'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from './fs.js'
import {describe, expect, test} from 'vitest'
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

  test('takes over a lock without a recent heartbeat even when its PID is alive', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Given a reused PID: the process exists, but nothing refreshes the lock.
      const paths = devInstancePaths({command: 'app dev', directory})
      await mkdir(paths.lockFile)
      const oneMinuteAgo = new Date(Date.now() - 60_000)
      await utimes(paths.lockFile, oneMinuteAgo, oneMinuteAgo)
      await writeFile(paths.infoFile, JSON.stringify({pid: process.ppid, logFile: paths.logFile, details: {}}))

      // When
      const instance = await acquireDevInstance({command: 'app dev', directory})

      // Then
      expect(instance.info.pid).toBe(process.pid)
      await instance.release()
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
})

describe('DevInstance log', () => {
  test('tees process output into a JSON Lines log without ANSI styling', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Given
      const instance = await acquireDevInstance({command: 'app dev', directory})
      const {stream: target, chunks} = collectingStream()
      const stdout = instance.tee(target, {source: 'web', stream: 'stdout'})

      // When
      stdout.write('\u001b[32mready\u001b[39m in 20ms\npartial ')
      stdout.write('line\n\n')
      instance.log({source: 'app dev', level: 'info', message: 'Preview URL: https://preview'})
      await new Promise<void>((resolve) => stdout.end(resolve))
      await instance.release()

      // Then
      expect(chunks.join('')).toBe('\u001b[32mready\u001b[39m in 20ms\npartial line\n\n')
      const entries = await readLog(instance.paths.logFile)
      expect(entries.map(({sessionId, ...entry}) => entry)).toEqual([
        {timestamp: expect.any(String), source: 'web', stream: 'stdout', message: 'ready in 20ms'},
        {timestamp: expect.any(String), source: 'web', stream: 'stdout', message: 'partial line'},
        {timestamp: expect.any(String), source: 'app dev', level: 'info', message: 'Preview URL: https://preview'},
      ])
      expect(entries.every((entry) => entry.sessionId === instance.info.sessionId)).toBe(true)
      expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    })
  })

  test('flushes a split UTF-8 line on release without requiring the source to end', async () => {
    await inTemporaryDirectory(async (directory) => {
      const instance = await acquireDevInstance({command: 'app dev', directory})
      const output = instance.tee(collectingStream().stream, {source: 'web', stream: 'stdout'})
      const bytes = Buffer.from('café')
      output.write(bytes.subarray(0, 4))
      output.write(bytes.subarray(4))
      await instance.release()
      await expect(readLog(instance.paths.logFile)).resolves.toEqual([
        expect.objectContaining({sessionId: instance.info.sessionId, source: 'web', message: 'café'}),
      ])
    })
  })

  test('starts each run with an empty log', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Given
      const first = await acquireDevInstance({command: 'app dev', directory})
      first.log({source: 'app dev', message: 'first run'})
      await first.release()

      // When
      const second = await acquireDevInstance({command: 'app dev', directory})
      expect(second.info.sessionId).not.toBe(first.info.sessionId)
      second.log({source: 'app dev', message: 'second run'})
      await second.release()

      // Then
      const entries = await readLog(second.paths.logFile)
      expect(entries.map((entry) => entry.message)).toEqual(['second run'])
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
