import {themeFlags} from './flags.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {jsonFlag} from '@shopify/cli-kit/node/cli'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {errorMapper, handler} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, writeFileSync} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

afterEach(() => vi.unstubAllEnvs())

class MockCommand extends Command {
  static flags = {
    ...themeFlags,
    ...jsonFlag,
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(MockCommand)
    return flags
  }

  async catch(): Promise<void> {}
}

describe('themeFlags', () => {
  describe('path', () => {
    test.each(['missing', 'file'])('reports an invalid %s path as a JSON error', async (kind) => {
      vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
      await inTemporaryDirectory(async (directory) => {
        const path = joinPath(directory, 'theme')
        if (kind === 'file') writeFileSync(path, 'content')
        const config = new Config({root: __dirname})
        await config.load()
        const argv = ['--json', '--path', path]
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          await runWithCommandEventsForCommand(argv, async () => {
            const command = new MockCommand(argv, config)
            const runningCommand = command.run()
            await expect(runningCommand).rejects.toThrow(kind === 'missing' ? "doesn't exist" : 'not a file')
            await runningCommand.catch(async (error) => handler(await errorMapper(error)))
          })
          expect(JSON.parse(stdout())).toMatchObject({
            error: {message: expect.stringContaining(kind === 'missing' ? "doesn't exist" : 'not a file')},
          })
          expect(stderr()).toBe('')
        })
      })
    })

    test('defaults to the current working directory', async () => {
      const flags = await MockCommand.run([])

      expect(flags.path).toEqual(cwd())
    })

    test('can be explicitly provided', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const flags = await MockCommand.run(['--path', tmpDir])

        expect(flags.path).toEqual(resolvePath(tmpDir))
      })
    })

    test("renders an error message and exits when the path doesn't exist", async () => {
      const mockOutput = mockAndCaptureOutput()

      await MockCommand.run(['--path', 'boom'])

      expect(mockOutput.error()).toMatch("A path was explicitly provided but doesn't exist")
    })

    test('renders an error message and exits when the path is a file instead of a directory', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const filePath = joinPath(tmpDir, 'section.liquid')
        writeFileSync(filePath, '{% schema %}{% endschema %}')

        const mockOutput = mockAndCaptureOutput()

        await MockCommand.run(['--path', filePath])

        expect(mockOutput.error()).toMatch('The path must be a directory, not a file')
        expect(mockOutput.error()).toMatch('section.liquid')
      })
    })
  })
})
