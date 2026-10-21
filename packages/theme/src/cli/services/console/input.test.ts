import {loadConsoleInputs} from './input.js'
import {expect, test} from 'vitest'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

test('keeps inline inputs in order and distinguishes interactive execution', async () => {
  await expect(loadConsoleInputs()).resolves.toBeUndefined()
  await expect(loadConsoleInputs(['shop.name', 'shop.currency'])).resolves.toEqual(['shop.name', 'shop.currency'])
})

test.each(['\n', '\r\n'])('reads one command per line with %j line endings', async (newline) => {
  await inTemporaryDirectory(async (directory) => {
    const inputFile = joinPath(directory, 'commands.txt')
    await writeFile(inputFile, ['assign name = shop.name', '', '  ', 'name | upcase', ''].join(newline))

    await expect(loadConsoleInputs(undefined, inputFile)).resolves.toEqual(['assign name = shop.name', 'name | upcase'])
  })
})

test('rejects an empty input file', async () => {
  await inTemporaryDirectory(async (directory) => {
    const inputFile = joinPath(directory, 'commands.txt')
    await writeFile(inputFile, '\n \r\n')

    await expect(loadConsoleInputs(undefined, inputFile)).rejects.toThrow('at least one Liquid command')
  })
})

test('rejects an unreadable input file', async () => {
  await inTemporaryDirectory(async (directory) => {
    await expect(loadConsoleInputs(undefined, joinPath(directory, 'missing.txt'))).rejects.toThrow()
  })
})
