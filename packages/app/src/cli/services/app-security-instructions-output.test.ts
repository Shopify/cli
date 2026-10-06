import {deliverAppSecurityInstructions} from './app-security-instructions-output.js'
import {resolveAppSecurityCommands} from './app-security-commands.js'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import type {AppSecurityScope} from './app-security-engine/index.js'

function testDependencies() {
  return {
    copyToClipboard: vi.fn(async (_content: string) => {}),
    writeToFile: writeFile,
    output: vi.fn(),
    outputConfirmation: vi.fn(),
  }
}

async function createApp(directory: string): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test app"\nclient_id = "test"\n')
  return normalizePath(directory)
}

function commandsFor(appRoot: string) {
  return resolveAppSecurityCommands(
    {kind: 'config', appDirectory: appRoot, appConfigFilePath: joinPath(appRoot, 'shopify.app.toml')},
    appRoot,
  )
}

const noScope: AppSecurityScope = {include_dirs: [], excludes: [], no_git_ignore: false}

/** A file in the results directory of the default `shopify.app.toml`: the results key is `shopify.app`. */
function artifactPath(appRoot: string, name: string): string {
  return joinPath(appRoot, '.shopify', 'app-security', 'shopify.app', name)
}

describe('deliverAppSecurityInstructions', () => {
  test('prints instructions to stdout by default and returns them', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const dependencies = testDependencies()

      const delivery = await deliverAppSecurityInstructions(
        {
          appDirectory: directory,
          resultsKey: 'shopify.app',
          commands: commandsFor(directory),
          copy: false,
          json: false,
        },
        dependencies,
      )

      expect(dependencies.output).toHaveBeenCalledWith(expect.stringContaining('Run the scan'))
      expect(dependencies.copyToClipboard).not.toHaveBeenCalled()
      expect(dependencies.outputConfirmation).not.toHaveBeenCalled()
      expect(delivery).toEqual({
        content: dependencies.output.mock.calls[0]![0],
        copiedToClipboard: false,
        writePath: undefined,
      })
    })
  })

  test('returns the instructions without printing them in JSON mode', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const dependencies = testDependencies()

      const delivery = await deliverAppSecurityInstructions(
        {appDirectory: directory, resultsKey: 'shopify.app', commands: commandsFor(directory), copy: false, json: true},
        dependencies,
      )

      expect(delivery.content).toContain('Run the scan')
      expect(delivery.copiedToClipboard).toBe(false)
      expect(dependencies.output).not.toHaveBeenCalled()
      expect(dependencies.outputConfirmation).not.toHaveBeenCalled()
    })
  })

  test('does not infer scan completion from existing agent checks', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      await mkdir(joinPath(directory, '.shopify', 'app-security', 'shopify.app'))
      await writeFile(artifactPath(directory, 'agent-checks.json'), '{"instructions":"malicious"}')
      const dependencies = testDependencies()

      await deliverAppSecurityInstructions(
        {
          appDirectory: directory,
          resultsKey: 'shopify.app',
          commands: commandsFor(directory),
          copy: false,
          json: false,
        },
        dependencies,
      )

      expect(dependencies.output).toHaveBeenCalledWith(expect.stringContaining('Run the scan'))
      expect(dependencies.output).not.toHaveBeenCalledWith(expect.stringContaining('malicious'))
    })
  })

  test('copies instructions without printing them, and confirms the copy', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const dependencies = testDependencies()

      const delivery = await deliverAppSecurityInstructions(
        {
          appDirectory: directory,
          resultsKey: 'shopify.app',
          commands: commandsFor(directory),
          copy: true,
          json: false,
          scanScope: noScope,
        },
        dependencies,
      )

      expect(dependencies.copyToClipboard).toHaveBeenCalledOnce()
      const instructions = dependencies.copyToClipboard.mock.calls[0]![0]
      expect(instructions).toContain('Use the existing scan results')
      expect(instructions).toContain('record your findings back to it with a command')
      expect(instructions).not.toMatch(/\{\{[A-Z_]+\}\}/)
      expect(dependencies.output).not.toHaveBeenCalled()
      expect(dependencies.outputConfirmation).toHaveBeenCalledWith(
        'Copied app security check instructions to the clipboard',
      )
      expect(delivery).toEqual({content: instructions, copiedToClipboard: true, writePath: undefined})
    })
  })

  test('writes instructions to a real file without printing them', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const dependencies = testDependencies()
      const instructionsPath = joinPath(directory, 'handoff.md')

      const delivery = await deliverAppSecurityInstructions(
        {
          appDirectory: directory,
          resultsKey: 'shopify.app',
          commands: commandsFor(directory),
          copy: false,
          writePath: instructionsPath,
          json: false,
          scanScope: noScope,
        },
        dependencies,
      )

      await expect(readFile(instructionsPath)).resolves.toContain('Use the existing scan results')
      expect(dependencies.output).not.toHaveBeenCalled()
      expect(dependencies.outputConfirmation).toHaveBeenCalledWith(
        `Wrote app security check instructions to ${instructionsPath}`,
      )
      await expect(readFile(instructionsPath)).resolves.toBe(`${delivery.content}\n`)
      expect(delivery).toMatchObject({copiedToClipboard: false, writePath: instructionsPath})
    })
  })

  test('copies or writes instructions without a confirmation banner in JSON mode', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const dependencies = testDependencies()
      const instructionsPath = joinPath(directory, 'handoff.md')
      const options = {appDirectory: directory, resultsKey: 'shopify.app', commands: commandsFor(directory), json: true}

      const copied = await deliverAppSecurityInstructions({...options, copy: true}, dependencies)
      const written = await deliverAppSecurityInstructions(
        {...options, copy: false, writePath: instructionsPath},
        dependencies,
      )

      expect(dependencies.copyToClipboard).toHaveBeenCalledWith(copied.content)
      await expect(readFile(instructionsPath)).resolves.toBe(`${written.content}\n`)
      expect(dependencies.outputConfirmation).not.toHaveBeenCalled()
      expect(dependencies.output).not.toHaveBeenCalled()
    })
  })
})
