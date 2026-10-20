import {renderSecurityInstructionsResult} from './result.js'
import {fileRealPath, inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {unstyled} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test} from 'vitest'
// eslint-disable-next-line no-restricted-imports -- Verify native filesystem paths in JSON output.
import {resolve} from 'node:path'
import type {AppSecuritySelection} from '../app-security-selection.js'

const INSTRUCTIONS = '# App security check instructions'

async function createApp(directory: string): Promise<AppSecuritySelection> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "test"\n')
  const appDirectory = await fileRealPath(directory)
  return {
    kind: 'config',
    appDirectory,
    appConfigFilePath: joinPath(appDirectory, 'shopify.app.toml'),
    configClientId: 'test',
  }
}

describe('renderSecurityInstructionsResult', () => {
  test('prints the instructions on stdout', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)

      await withCapturedStandardStreams(({stdout, stderr}) => {
        renderSecurityInstructionsResult(INSTRUCTIONS, {selection, delivery: {copy: false}}, 'text')

        expect(stdout()).toBe(`${INSTRUCTIONS}\n`)
        expect(stderr()).toBe('')
      })
    })
  })

  test('confirms copied instructions on stderr without printing them', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)

      await withCapturedStandardStreams(({stdout, stderr}) => {
        renderSecurityInstructionsResult(INSTRUCTIONS, {selection, delivery: {copy: true}}, 'text')

        expect(stdout()).toBe('')
        expect(unstyled(stderr())).toContain('Copied app security check instructions to the clipboard')
      })
    })
  })

  test('writes one JSON result with the selected app, the results directory and the instructions', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)
      const {appDirectory} = selection

      await withCapturedStandardStreams(({stdout, stderr}) => {
        renderSecurityInstructionsResult(INSTRUCTIONS, {selection, delivery: {copy: false}}, 'json')

        expect(JSON.parse(stdout())).toStrictEqual({
          status: 'success',
          app: {
            directory: resolve(appDirectory),
            configurationPath: resolve(appDirectory, 'shopify.app.toml'),
            clientId: 'test',
          },
          resultsDirectory: resolve(appDirectory, '.shopify', 'app-security', 'shopify.app'),
          instructions: {content: INSTRUCTIONS, copied: false},
        })
        expect(stderr()).toBe('')
      })
    })
  })

  test('writes a JSON result with copied instructions and no confirmation', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)

      await withCapturedStandardStreams(({stdout, stderr}) => {
        renderSecurityInstructionsResult(INSTRUCTIONS, {selection, delivery: {copy: true}}, 'json')

        expect(JSON.parse(stdout())).toMatchObject({instructions: {content: INSTRUCTIONS, copied: true}})
        expect(stderr()).toBe('')
      })
    })
  })

  test('writes a JSON result under the --client-id results key without app configuration', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await fileRealPath(directory)
      const selection: AppSecuritySelection = {
        kind: 'no-config',
        appDirectory,
        clientId: 'flag-client-id',
        clientIdSource: 'flag',
      }

      await withCapturedStandardStreams(({stdout}) => {
        renderSecurityInstructionsResult(INSTRUCTIONS, {selection, delivery: {copy: false}}, 'json')

        expect(JSON.parse(stdout())).toStrictEqual({
          status: 'success',
          app: {directory: resolve(appDirectory), configurationPath: null, clientId: 'flag-client-id'},
          resultsDirectory: resolve(appDirectory, '.shopify', 'app-security', 'flag-client-id'),
          instructions: {content: INSTRUCTIONS, copied: false},
        })
      })
    })
  })

  test('with a written file, confirms it on stderr in text and writes only its path and format in JSON', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)
      const writePath = joinPath(selection.appDirectory, 'instructions.md')
      const options = {selection, delivery: {copy: false, writePath}}

      await withCapturedStandardStreams(({stdout, stderr}) => {
        renderSecurityInstructionsResult(INSTRUCTIONS, options, 'text')

        expect(stdout()).toBe('')
        expect(unstyled(stderr())).toContain('Wrote app security check instructions to')
      })
      await withCapturedStandardStreams(({stdout, stderr}) => {
        renderSecurityInstructionsResult(INSTRUCTIONS, options, 'json')

        expect(JSON.parse(stdout())).toStrictEqual({
          path: resolve(selection.appDirectory, 'instructions.md'),
          format: 'markdown',
        })
        expect(stderr()).toBe('')
      })
    })
  })
})
