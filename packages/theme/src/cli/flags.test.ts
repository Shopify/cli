import {themeFlags} from './flags.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {jsonFlag} from '@shopify/cli-kit/node/cli'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {errorMapper, handler} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, writeFileSync} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

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
    test.each(['missing', 'file'].flatMap((kind) => [false, true].map((json) => ({kind, json}))))(
      'reports an invalid $kind path with json=$json',
      async ({kind, json}) => {
        vi.stubEnv('SHOPIFY_FLAG_JSON', json ? '1' : '0')
        await inTemporaryDirectory(async (directory) => {
          const path = joinPath(directory, 'theme')
          if (kind === 'file') writeFileSync(path, 'content')
          const config = new Config({root: __dirname})
          await config.load()
          const argv = [...(json ? ['--json'] : []), '--path', path]
          await withCapturedStandardStreams(async ({stdout, stderr}) => {
            await runWithCommandEventsForCommand(argv, async () => {
              const command = new MockCommand(argv, config)
              const runningCommand = command.run()
              await expect(runningCommand).rejects.toThrow(kind === 'missing' ? "doesn't exist" : 'not a file')
              await runningCommand.catch(async (error) => handler(await errorMapper(error)))
            })
            if (json) {
              expect(JSON.parse(stdout())).toMatchObject({
                error: {message: expect.stringContaining(kind === 'missing' ? "doesn't exist" : 'not a file')},
              })
              expect(stderr()).toBe('')
            } else {
              expect(stdout()).toBe('')
              expect(stderr()).toContain(kind === 'missing' ? "doesn't exist" : 'not a file')
            }
          })
        })
      },
    )

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
  })
})
