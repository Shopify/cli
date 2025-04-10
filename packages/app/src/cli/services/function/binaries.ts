import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {chmod, createFileWriteStream, fileExists, inTemporaryDirectory, mkdir, moveFile} from '@shopify/cli-kit/node/fs'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {fetch} from '@shopify/cli-kit/node/http'
import {PipelineSource} from 'stream'
import {pipeline} from 'stream/promises'
import stream from 'node:stream/promises'
import fs from 'node:fs'
import * as gzip from 'node:zlib'
import {fileURLToPath} from 'node:url'

const FUNCTION_RUNNER_VERSION = 'v7.0.1'
const JAVY_VERSION = 'v4.0.0'
// The Javy plugin version should match the plugin version used in the
// function-runner version specified above.
const JAVY_PLUGIN_VERSION = 'v1'

const BINARYEN_VERSION = '123.0.0'

interface DownloadableBinary {
  path: string
  name: string
  version: string

  downloadUrl(processPlatform: string, processArch: string): string
  processResponse(responseStream: PipelineSource<unknown>, outputStream: fs.WriteStream): Promise<void>
}

// The logic for determining the download URL and what to do with the response stream is _coincidentally_ the same for
// Javy and function-runner for now. Those methods may not continue to have the same logic in the future. If they
// diverge, create different classes to handle the different logic polymorphically.
class Executable implements DownloadableBinary {
  readonly name: string
  readonly version: string
  readonly path: string
  private readonly gitHubRepo: string

  constructor(name: string, version: string, gitHubRepo: string) {
    this.name = name
    this.version = version
    const filename = process.platform === 'win32' ? `${name}.exe` : name
    this.path = joinPath(dirname(fileURLToPath(import.meta.url)), '..', 'bin', filename)
    this.gitHubRepo = gitHubRepo
  }

  downloadUrl(processPlatform: string, processArch: string) {
    let platform
    let arch
    switch (processPlatform.toLowerCase()) {
      case 'darwin':
        platform = 'macos'
        break
      case 'linux':
        platform = 'linux'
        break
      case 'win32':
        platform = 'windows'
        break
      default:
        throw Error(`Unsupported platform ${processPlatform}`)
    }
    switch (processArch.toLowerCase()) {
      case 'arm':
      case 'arm64':
        arch = 'arm'
        break
      // A 32 bit arch likely needs that someone has 32bit Node installed on a
      // 64 bit system, and wasmtime doesn't support 32bit anyway.
      case 'ia32':
      case 'x64':
        arch = 'x86_64'
        break
      default:
        throw Error(`Unsupported architecture ${processArch}`)
    }

    const archPlatform = `${arch}-${platform}`
    // These are currently the same between both binaries _coincidentally_.
    const supportedTargets = ['arm-linux', 'arm-macos', 'x86_64-macos', 'x86_64-windows', 'x86_64-linux']
    if (!supportedTargets.includes(archPlatform)) {
      throw Error(`Unsupported platform/architecture combination ${processPlatform}/${processArch}`)
    }

    return `https://github.com/${this.gitHubRepo}/releases/download/${this.version}/${this.name}-${archPlatform}-${this.version}.gz`
  }

  async processResponse(responseStream: PipelineSource<unknown>, outputStream: fs.WriteStream): Promise<void> {
    return gunzipResponse(responseStream, outputStream)
  }
}

class JavyPlugin implements DownloadableBinary {
  readonly name: string
  readonly version: string
  readonly path: string

  constructor() {
    this.name = `shopify_functions_javy_${JAVY_PLUGIN_VERSION}`
    this.version = JAVY_PLUGIN_VERSION
    this.path = joinPath(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'bin',
      `shopify_functions_javy_${JAVY_PLUGIN_VERSION}.wasm`,
    )
  }

  downloadUrl(_processPlatform: string, _processArch: string) {
    return `https://cdn.shopify.com/shopifycloud/shopify-functions-javy-plugin/shopify_functions_javy_${JAVY_PLUGIN_VERSION}.wasm`
  }

  async processResponse(responseStream: PipelineSource<unknown>, outputStream: fs.WriteStream): Promise<void> {
    return pipeline(responseStream, outputStream)
  }
}

class WasmOptExecutable implements DownloadableBinary {
  readonly name: string
  readonly version: string
  readonly path: string

  constructor(name: string, version: string) {
    this.name = name
    this.version = version
    this.path = joinPath(dirname(fileURLToPath(import.meta.url)), '..', 'bin', name)
  }

  downloadUrl(_processPlatform: string, _processArch: string) {
    return `https://cdn.jsdelivr.net/npm/binaryen@${this.version}/bin/wasm-opt`
  }

  async processResponse(responseStream: PipelineSource<unknown>, outputStream: fs.WriteStream): Promise<void> {
    await stream.pipeline(responseStream, outputStream)
  }
}

let _javy: DownloadableBinary
let _javyPlugin: DownloadableBinary
let _functionRunner: DownloadableBinary
let _wasmOpt: DownloadableBinary

export function javyBinary() {
  if (!_javy) {
    _javy = new Executable('javy', JAVY_VERSION, 'bytecodealliance/javy')
  }
  return _javy
}

export function javyPluginBinary() {
  if (!_javyPlugin) {
    _javyPlugin = new JavyPlugin()
  }
  return _javyPlugin
}

export function functionRunnerBinary() {
  if (!_functionRunner) {
    _functionRunner = new Executable('function-runner', FUNCTION_RUNNER_VERSION, 'Shopify/function-runner')
  }
  return _functionRunner
}

export function wasmOptBinary() {
  if (!_wasmOpt) {
    _wasmOpt = new WasmOptExecutable('wasm-opt.cjs', BINARYEN_VERSION)
  }

  return _wasmOpt
}

export async function downloadBinary(bin: DownloadableBinary) {
  const isDownloaded = await fileExists(bin.path)
  if (isDownloaded) {
    return
  }

  const url = bin.downloadUrl(process.platform, process.arch)
  outputDebug(`Downloading ${bin.name} ${bin.version} from ${url} to ${bin.path}`)
  const dir = dirname(bin.path)
  if (!(await fileExists(dir))) {
    await mkdir(dir)
  }
  await performActionWithRetryAfterRecovery(
    async () => {
      const resp = await fetch(url, undefined, 'slow-request')
      if (resp.status !== 200) {
        throw new Error(`Downloading ${bin.name} failed with status code of ${resp.status}`)
      }

      const responseStream = resp.body
      if (responseStream === null) {
        throw new Error(`Downloading ${bin.name} failed with empty response body`)
      }

      // Download to a temp location and then move the file only after it's fully processed
      // so the `isDownloaded` check above will continue to return false if the file hasn't
      // been fully processed.
      await inTemporaryDirectory(async (tmpDir) => {
        const tmpFile = joinPath(tmpDir, 'binary')
        const outputStream = createFileWriteStream(tmpFile)
        await bin.processResponse(responseStream, outputStream)
        await chmod(tmpFile, 0o775)
        await moveFile(tmpFile, bin.path, {overwrite: true})
      })
    },
    async () => {},
    2,
  )
}

async function gunzipResponse(responseStream: PipelineSource<unknown>, outputStream: fs.WriteStream): Promise<void> {
  const gunzip = gzip.createGunzip()
  await stream.pipeline(responseStream, gunzip, outputStream)
}
