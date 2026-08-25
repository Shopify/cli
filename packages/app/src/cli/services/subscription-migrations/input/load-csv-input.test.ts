import {loadCsvInput} from './load-csv-input.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

describe('loadCsvInput', () => {
  test('reads a CSV file from the real filesystem', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'migrations.csv')
      await writeFile(path, 'shop_id\n123\n')

      await expect(loadCsvInput(path)).resolves.toBe('shop_id\n123\n')
    })
  })

  test('throws an AbortError with the exact path when the CSV file does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'missing.csv')

      const promise = loadCsvInput(path)

      await expect(promise).rejects.toBeInstanceOf(AbortError)
      await expect(promise).rejects.toMatchObject({message: `CSV file not found: ${path}`})
    })
  })

  test('wraps CSV file read failures in an actionable AbortError', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'unreadable.csv')
      const fileExists = vi.fn().mockResolvedValue(true)
      const readFile = vi.fn().mockRejectedValue(new Error('Permission denied'))

      const promise = loadCsvInput(path, {fileExists, readFile})

      await expect(promise).rejects.toBeInstanceOf(AbortError)
      await expect(promise).rejects.toMatchObject({
        message: `Couldn't read CSV file ${path}: Permission denied`,
      })
      expect(fileExists).toHaveBeenCalledWith(path)
      expect(readFile).toHaveBeenCalledWith(path)
    })
  })

  test('does not replace an existing AbortError from the file reader', async () => {
    const existingError = new AbortError('File reader already explained the failure.')
    const fileExists = vi.fn().mockResolvedValue(true)
    const readFile = vi.fn().mockRejectedValue(existingError)

    await expect(loadCsvInput('migrations.csv', {fileExists, readFile})).rejects.toBe(existingError)
  })

  test('reads injected stdin when input is a dash', async () => {
    const readStdin = vi.fn().mockResolvedValue('shop_id\n123')

    await expect(loadCsvInput('-', {readStdin})).resolves.toBe('shop_id\n123')
  })

  test('throws an AbortError with the exact message when stdin has no data', async () => {
    const readStdin = vi.fn().mockResolvedValue(undefined)

    const promise = loadCsvInput('-', {readStdin})

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toMatchObject({
      message: 'Provide --input <path> or pipe CSV data to stdin.',
    })
  })
})
