import {themeFlags} from './flags.js'
import {describe, expect, test} from 'vitest'
import Command from '@shopify/cli-kit/node/base-command'
import {inTemporaryDirectory, writeFileSync} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

class MockCommand extends Command {
  static flags = {
    ...themeFlags,
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(MockCommand)
    return flags
  }

  async catch(): Promise<void> {}
}

describe('themeFlags', () => {
  describe('path', () => {
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
