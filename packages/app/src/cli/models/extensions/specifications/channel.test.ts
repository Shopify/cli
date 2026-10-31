import {CHANNEL_CONFIG_IDENTIFIER, CHANNEL_CONFIG_SPECIFICATIONS_DIRECTORY} from './channel.js'
import {loadLocalExtensionsSpecifications} from '../load-specifications.js'
import {ExtensionInstance} from '../extension-instance.js'
import {executeIncludeAssetsStep} from '../../../services/build/steps/include-assets-step.js'
import {inTemporaryDirectory, mkdir, writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import type {BuildContext} from '../../../services/build/client-steps.js'

async function channelConfigDeployStep() {
  const specifications = await loadLocalExtensionsSpecifications()
  const specification = specifications.find((spec) => spec.identifier === CHANNEL_CONFIG_IDENTIFIER)!
  const deploy = specification.clientSteps!.find(({lifecycle}) => lifecycle === 'deploy')!
  return deploy.steps[0]!
}

function buildContext(extensionDirectory: string, outputDirectory: string): BuildContext {
  return {
    extension: {
      directory: extensionDirectory,
      outputPath: joinPath(outputDirectory, 'extension.js'),
    } as ExtensionInstance,
    options: {
      stdout: {write: vi.fn()},
      stderr: {write: vi.fn()},
      app: {directory: extensionDirectory} as any,
      environment: 'production',
    } as any,
    stepResults: new Map(),
  }
}

async function runDeployStepOver(files: string[]) {
  return inTemporaryDirectory(async (tmpDir) => {
    const extensionDirectory = joinPath(tmpDir, 'extension')
    const outputDirectory = joinPath(tmpDir, 'output')
    await mkdir(joinPath(extensionDirectory, CHANNEL_CONFIG_SPECIFICATIONS_DIRECTORY))
    await mkdir(outputDirectory)
    await Promise.all(
      files.map(async (file) => {
        const filePath = joinPath(extensionDirectory, file)
        await mkdir(dirname(filePath))
        await writeFile(filePath, 'content')
      }),
    )

    const result = await executeIncludeAssetsStep(
      await channelConfigDeployStep(),
      buildContext(extensionDirectory, outputDirectory),
    )

    const bundled = await Promise.all(
      files.map(async (file) => [file, await fileExists(joinPath(outputDirectory, file))] as const),
    )
    return {filesCopied: result.filesCopied, bundled: Object.fromEntries(bundled)}
  })
}

describe('channel_config', () => {
  test('bundles every spec file format, at any depth, under the specifications directory', async () => {
    const specFiles = [
      'specifications/channel.json',
      'specifications/channel.toml',
      'specifications/channel.yaml',
      'specifications/channel.yml',
      'specifications/icon.svg',
      'specifications/nested/deep/channel.json',
    ]

    const {filesCopied, bundled} = await runDeployStepOver(specFiles)

    expect(bundled).toEqual(Object.fromEntries(specFiles.map((file) => [file, true])))
    expect(filesCopied).toBe(specFiles.length)
  })

  test('leaves out files the channel spec contract does not cover', async () => {
    const excluded = [
      'specifications/notes.md',
      'specifications/build.js',
      'specifications/logo.png',
      'shopify.extension.toml',
      'other/channel.json',
    ]

    const {filesCopied, bundled} = await runDeployStepOver(excluded)

    expect(bundled).toEqual(Object.fromEntries(excluded.map((file) => [file, false])))
    expect(filesCopied).toBe(0)
  })
})
