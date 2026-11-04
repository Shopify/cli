import {inspectErrorReason, isMissingFilesystemEntry} from '../scanners/filesystem-errors.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {readdir, stat} from 'node:fs/promises'

/** The error a real filesystem call throws, so the codes under test are the ones Node actually produces. */
async function thrownBy(call: () => Promise<unknown>): Promise<unknown> {
  const outcome = await call().then(
    () => undefined,
    (error: unknown) => ({error}),
  )
  if (outcome === undefined) throw new Error('Expected the filesystem call to fail')
  return outcome.error
}

describe('isMissingFilesystemEntry', () => {
  test('is true for a path that does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      const error = await thrownBy(() => stat(joinPath(directory, 'absent')))

      expect(isMissingFilesystemEntry(error)).toBe(true)
    })
  })

  test('is true for a path that walks through a file', async () => {
    await inTemporaryDirectory(async (directory) => {
      const file = joinPath(directory, 'app.ts')
      await writeFile(file, 'export const value = 1')

      const error = await thrownBy(() => readdir(joinPath(file, 'child')))

      expect(isMissingFilesystemEntry(error)).toBe(true)
    })
  })

  test('is false for an unreadable entry, which the scanners report rather than skip', () => {
    expect(isMissingFilesystemEntry(Object.assign(new Error('permission denied'), {code: 'EACCES'}))).toBe(false)
  })

  test('is false for an error with no code and for values that are not errors', () => {
    expect(isMissingFilesystemEntry(new Error('boom'))).toBe(false)
    expect(isMissingFilesystemEntry({code: 'ENOENT'})).toBe(false)
    expect(isMissingFilesystemEntry('ENOENT')).toBe(false)
    expect(isMissingFilesystemEntry(undefined)).toBe(false)
  })
})

describe('inspectErrorReason', () => {
  test('names the target and the code of a real filesystem error', async () => {
    await inTemporaryDirectory(async (directory) => {
      const error = await thrownBy(() => stat(joinPath(directory, 'absent')))

      expect(inspectErrorReason('scan directory', error)).toBe('Could not inspect scan directory (ENOENT)')
    })
  })

  test('leaves out the code when the error carries none', () => {
    expect(inspectErrorReason('app root', new Error('boom'))).toBe('Could not inspect app root')
  })

  test('leaves out the code when it is not a string', () => {
    expect(inspectErrorReason('app root', Object.assign(new Error('boom'), {code: 13}))).toBe(
      'Could not inspect app root',
    )
  })

  test('names the target for values that are not errors', () => {
    expect(inspectErrorReason('app/routes', 'ENOENT')).toBe('Could not inspect app/routes')
    expect(inspectErrorReason('app/routes', undefined)).toBe('Could not inspect app/routes')
  })
})
