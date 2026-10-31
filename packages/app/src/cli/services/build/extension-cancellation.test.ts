import {buildFunctionExtension} from './extension.js'
import {testAppLinked, testFunctionExtension} from '../../models/app/app.test-data.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {fileExists, inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {expect, test, vi} from 'vitest'
import lockfile from 'proper-lockfile'
import {Writable} from 'stream'

vi.mock('../function/schema-version.js')

test('cancels a build waiting for a real lock without starting its command', async () => {
  await inTemporaryDirectory(async (directory) => {
    const extension = await testFunctionExtension({dir: directory})
    extension.configuration.build!.command = 'node build.cjs'
    await writeFile(joinPath(directory, 'build.cjs'), "require('node:fs').writeFileSync('started', 'yes')")
    const lockfilePath = joinPath(directory, '.build-lock')
    const release = await lockfile.lock(directory, {lockfilePath})
    const lock = vi.spyOn(lockfile, 'lock')
    const controller = new AbortController()
    let settled = false
    const building = buildFunctionExtension(extension, {
      app: testAppLinked({directory}),
      stdout: process.stderr,
      stderr: process.stderr,
      environment: 'development',
      signal: controller.signal,
    })
    const result = building
      .catch((error: unknown) => error)
      .finally(() => {
        settled = true
      })

    try {
      await vi.waitFor(() => expect(lock).toHaveBeenCalled())
      await expect(lock.mock.results[0]!.value).rejects.toMatchObject({code: 'ELOCKED'})
      controller.abort()
      await vi.waitFor(() => expect(settled).toBe(true))
      await expect(result).resolves.toBeInstanceOf(AbortSilentError)
      await expect(lockfile.check(directory, {lockfilePath})).resolves.toBe(true)
      await expect(fileExists(joinPath(directory, 'started'))).resolves.toBe(false)
    } finally {
      controller.abort()
      await release()
      await result
      lock.mockRestore()
    }
  })
})

test('builds after the current lock holder releases the lock', async () => {
  await inTemporaryDirectory(async (directory) => {
    const extension = await testFunctionExtension({dir: directory})
    extension.configuration.build!.command = 'node build.cjs'
    await writeFile(joinPath(directory, 'build.cjs'), "require('node:fs').writeFileSync('started', 'yes')")
    const lockfilePath = joinPath(directory, '.build-lock')
    const release = await lockfile.lock(directory, {lockfilePath})
    const lock = vi.spyOn(lockfile, 'lock')
    const controller = new AbortController()
    const building = buildFunctionExtension(extension, {
      app: testAppLinked({directory}),
      stdout: process.stderr,
      stderr: process.stderr,
      environment: 'development',
      signal: controller.signal,
    })
    const result = building.catch((error: unknown) => error)

    try {
      try {
        await vi.waitFor(() => expect(lock).toHaveBeenCalled())
        await expect(lock.mock.results[0]!.value).rejects.toMatchObject({code: 'ELOCKED'})
      } finally {
        await release()
      }

      await expect(result).resolves.toMatchObject({status: 'success'})
      await expect(fileExists(joinPath(directory, 'started'))).resolves.toBe(true)
      await expect(lockfile.check(directory, {lockfilePath})).resolves.toBe(false)
    } finally {
      controller.abort()
      await result
      lock.mockRestore()
    }
  })
})

test('releases a newly acquired lock if cancellation arrives before the build starts', async () => {
  await inTemporaryDirectory(async (directory) => {
    const extension = await testFunctionExtension({dir: directory})
    extension.configuration.build!.command = 'node build.cjs'
    await writeFile(joinPath(directory, 'build.cjs'), "require('node:fs').writeFileSync('started', 'yes')")
    const controller = new AbortController()
    const acquireLock = lockfile.lock.bind(lockfile)
    vi.spyOn(lockfile, 'lock').mockImplementationOnce(async (file, options) => {
      const release = await acquireLock(file, options)
      controller.abort()
      return release
    })

    await expect(
      buildFunctionExtension(extension, {
        app: testAppLinked({directory}),
        stdout: process.stderr,
        stderr: process.stderr,
        environment: 'development',
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(AbortSilentError)

    await expect(fileExists(joinPath(directory, 'started'))).resolves.toBe(false)
    await expect(lockfile.check(directory, {lockfilePath: joinPath(directory, '.build-lock')})).resolves.toBe(false)
  })
})

test('silently cancels a running build and releases its lock', async () => {
  await inTemporaryDirectory(async (directory) => {
    const extension = await testFunctionExtension({dir: directory})
    extension.configuration.build!.command = 'node build.cjs'
    await writeFile(joinPath(directory, 'build.cjs'), "process.stdout.write('ready'); setInterval(() => {}, 1000)")
    const controller = new AbortController()
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        if (chunk.toString().includes('ready')) controller.abort()
        callback()
      },
    })

    try {
      await expect(
        buildFunctionExtension(extension, {
          app: testAppLinked({directory}),
          stdout,
          stderr: process.stderr,
          environment: 'development',
          signal: controller.signal,
        }),
      ).rejects.toBeInstanceOf(AbortSilentError)
      expect(controller.signal.aborted).toBe(true)
      await expect(lockfile.check(directory, {lockfilePath: joinPath(directory, '.build-lock')})).resolves.toBe(false)
    } finally {
      controller.abort()
      stdout.end()
    }
  })
})

test('silently skips a build whose signal is already aborted', async () => {
  await inTemporaryDirectory(async (directory) => {
    const extension = await testFunctionExtension({dir: directory})
    const controller = new AbortController()
    controller.abort()

    await expect(
      buildFunctionExtension(extension, {
        app: testAppLinked({directory}),
        stdout: process.stderr,
        stderr: process.stderr,
        environment: 'development',
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(AbortSilentError)

    await expect(fileExists(joinPath(directory, '.build-lock'))).resolves.toBe(false)
  })
})
