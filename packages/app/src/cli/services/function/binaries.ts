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

export const PREFERRED_FUNCTION_RUNNER_VERSION = 'v9.0.0'

// Javy dependencies.
export const PREFERRED_JAVY_VERSION = 'v5.0.3'
// The Javy plugin version should match the plugin version used in the
// function-runner version specified above.
export const PREFERRED_JAVY_PLUGIN_VERSION = 'v2'

const BINARYEN_VERSION = '123.0.0'

export const V1_TRAMPOLINE_VERSION = 'v1.0.2'
export const V2_TRAMPOLINE_VERSION = 'v2.0.0'

interface DownloadableBinary {
  path: string
  name: string
  version: string

  downloadUrl(processPlatform: string, processArch: string): string
  processResponse(responseStream: PipelineSource<unknown>, outputStream: fs.WriteStream): Promise<void>
}

export interface BinaryDependencies {
  functionRunner: string
  javy: string
  javyPlugin: string
}

// Derives the binary dependencies to be used with a particular
// `@shopify/shopify_function` package version.
export function deriveJavaScriptBinaryDependencies(version: string): BinaryDependencies | null {
  if (version === '0' || version === '1') {
    return {
      functionRunner: 'v7.0.1',
      javy: 'v4.0.0',
      javyPlugin: 'v1',
    }
  } else if (version === '2') {
    return {
      functionRunner: PREFERRED_FUNCTION_RUNNER_VERSION,
      javy: PREFERRED_JAVY_VERSION,
      javyPlugin: PREFERRED_JAVY_PLUGIN_VERSION,
    }
  } else {
    return null
  }
}

// The logic for determining the download URL and what to do with the response stream is _coincidentally_ the same for
// Javy and function-runner for now. Those methods may not continue to have the same logic in the future. If they
// diverge, create different classes to handle the different logic polymorphically.
class Executable implements DownloadableBinary {
  readonly name: string
  readonly version: string
  readonly path: string
  readonly release: string
  private readonly gitHubRepo: string

  constructor(name: string, version: string, gitHubRepo: string, release = version) {
    this.name = name
    this.version = version
    this.release = release

    let filename: string
    // add version to the filename
    filename = `${name}-${version}`
    // add .exe if it's windows
    filename = process.platform === 'win32' ? `${filename}.exe` : filename

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

    return `https://github.com/${this.gitHubRepo}/releases/download/${this.release}/${this.name}-${archPlatform}-${this.version}.gz`
  }

  async processResponse(responseStream: PipelineSource<unknown>, outputStream: fs.WriteStream): Promise<void> {
    return gunzipResponse(responseStream, outputStream)
  }
}

class JavyPlugin implements DownloadableBinary {
  readonly name: string
  readonly version: string
  readonly path: string

  constructor(version: string) {
    this.name = `shopify_functions_javy_${version}`
    this.version = version
    this.path = joinPath(dirname(fileURLToPath(import.meta.url)), '..', 'bin', `shopify_functions_javy_${version}.wasm`)
  }

  downloadUrl(_processPlatform: string, _processArch: string) {
    return `https://cdn.shopify.com/shopifycloud/shopify-functions-javy-plugin/shopify_functions_javy_${this.version}.wasm`
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

let _wasmOpt: DownloadableBinary

export function javyBinary(version: string = PREFERRED_JAVY_VERSION) {
  return new Executable('javy', version, 'bytecodealliance/javy') as DownloadableBinary
}

export function javyPluginBinary(version: string = PREFERRED_JAVY_PLUGIN_VERSION) {
  return new JavyPlugin(version) as DownloadableBinary
}

export function functionRunnerBinary(version: string = PREFERRED_FUNCTION_RUNNER_VERSION) {
  return new Executable('function-runner', version, 'Shopify/function-runner') as DownloadableBinary
}

export function wasmOptBinary() {
  if (!_wasmOpt) {
    _wasmOpt = new WasmOptExecutable('wasm-opt.cjs', BINARYEN_VERSION)
  }

  return _wasmOpt
}

export function trampolineBinary(version: string) {
  return new Executable(
    'shopify-function-trampoline',
    version,
    'Shopify/shopify-function-wasm-api',
    `shopify_function_trampoline/${version}`,
  )
}

const downloadsInProgress = new Map<string, Promise<void>>()

export async function downloadBinary(bin: DownloadableBinary) {
  const isDownloaded = await fileExists(bin.path)
  if (isDownloaded) {
    return
  }

  // Downloads cannot run concurrently with `exec` since the `moveFile`
  // operation is not atomic. It will delete the destination file if it exists
  // which will cause `exec` to break if it tries to execute the file before
  // the source file has been moved.
  // We prevent downloads from happening concurrently with `exec` by enforcing
  // that only one download happens for an executable. If we get here, we check
  // if a download is in progress, wait for it to finish, and return without
  // downloading again. If it's not in progress, then we start the download.
  const downloadPromise = downloadsInProgress.get(bin.path)
  if (downloadPromise) {
    await downloadPromise
    // Return now since we can assume it's downloaded. If it's not, an exception should've
    // been thrown before which will cause the user-level operation to fail anyway.
    return
  }

  // Do not perform any `await`s until we've called `downloadsInProgress.set`.
  // Calling `await` before that can cause a different JS task to become active
  // and start a concurrent download for this binary.

  // My mental model is `performDownload` without the `await` will run
  // synchronously until the first `await` in the function and then
  // immediately return the promise which we then immediately store. Since JS
  // doesn't have preemptive concurrency, we should be able to safely assume a
  // different task in the task queue will not run in between starting
  // `downloadFn` and the `set` operation on the following line.
  const downloadOp = performDownload(bin)
  downloadsInProgress.set(bin.path, downloadOp)
  // Ensure we clean the entry if there's a failure.
  try {
    // Wait for the download to finish
    await downloadOp
  } finally {
    downloadsInProgress.delete(bin.path)
  }
}

async function performDownload(bin: DownloadableBinary) {
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
