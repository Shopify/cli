import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {chmod, createFileWriteStream, fileExists, mkdir, removeFile, renameFile} from '@shopify/cli-kit/node/fs'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {fetch} from '@shopify/cli-kit/node/http'
import {versionSatisfies} from '@shopify/cli-kit/node/node-package-manager'
import {PipelineSource} from 'stream'
import {pipeline} from 'stream/promises'
import stream from 'node:stream/promises'
import fs from 'node:fs'
import * as gzip from 'node:zlib'
import {fileURLToPath} from 'node:url'

export const PREFERRED_FUNCTION_RUNNER_VERSION = '9.2.3'

// Javy dependencies.
export const PREFERRED_JAVY_VERSION = '9.1.0'
// The Javy plugin version should match the plugin version used in the
// function-runner version specified above.
export const PREFERRED_JAVY_PLUGIN_VERSION = '4'

const BINARYEN_VERSION = '123.0.0'

export const V1_TRAMPOLINE_VERSION = '1.0.2'
export const V2_TRAMPOLINE_VERSION = '2.0.1'

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
      functionRunner: '7.0.1',
      javy: '4.0.0',
      javyPlugin: '1',
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
  private readonly supportsWindowsOnArm: boolean

  constructor(
    name: string,
    version: string,
    gitHubRepo: string,
    supportsWindowsOnArm: boolean,
    release = `v${version}`,
  ) {
    this.name = name
    this.version = version
    this.release = release
    this.supportsWindowsOnArm = supportsWindowsOnArm

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
    const supportedTargets = ['arm-linux', 'arm-macos', 'x86_64-macos', 'x86_64-windows', 'x86_64-linux']
    if (this.supportsWindowsOnArm) {
      supportedTargets.push('arm-windows')
    }
    if (!supportedTargets.includes(archPlatform)) {
      throw Error(`Unsupported platform/architecture combination ${processPlatform}/${processArch}`)
    }

    return `https://github.com/${this.gitHubRepo}/releases/download/${this.release}/${this.name}-${archPlatform}-v${this.version}.gz`
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
    this.name = `shopify_functions_javy_v${version}`
    this.version = version
    this.path = joinPath(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'bin',
      `shopify_functions_javy_v${version}.wasm`,
    )
  }

  downloadUrl(_processPlatform: string, _processArch: string) {
    return `https://cdn.shopify.com/shopifycloud/shopify-functions-javy-plugin/shopify_functions_javy_v${this.version}.wasm`
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
  return new Executable(
    'javy',
    version,
    'bytecodealliance/javy',
    versionSatisfies(version, '>=7.0.0'),
  ) as DownloadableBinary
}

export function javyPluginBinary(version: string = PREFERRED_JAVY_PLUGIN_VERSION) {
  return new JavyPlugin(version) as DownloadableBinary
}

export function functionRunnerBinary(version: string = PREFERRED_FUNCTION_RUNNER_VERSION) {
  return new Executable(
    'function-runner',
    version,
    'Shopify/function-runner',
    versionSatisfies(version, '>=9.1.1'),
  ) as DownloadableBinary
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
    versionSatisfies(version, '>=2.0.1'),
    `shopify_function_trampoline/v${version}`,
  )
}

const downloadsInProgress = new Map<string, Promise<void>>()

export async function downloadBinary(bin: DownloadableBinary) {
  // If the file exists but its download is still in progress, the file cannot be used yet and we
  // must wait for the download process to finish first.
  // The `downloadsInProgress` check must happen after the async operation so the next `get` check
  // runs in the same microtask.
  const isDownloaded = (await fileExists(bin.path)) && !downloadsInProgress.has(bin.path)
  if (isDownloaded) {
    return
  }

  // Only one download happens for an executable in this process. If we get
  // here, we check if a download is in progress, wait for it to finish, and
  // return without downloading again. If it's not in progress, then we start
  // the download.
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

      // Download next to the binary and rename the file into place only after it's fully processed. The rename
      // is atomic because both paths are on the same file system, so no CLI process can see or execute a
      // binary that is still open for writing, which fails with ETXTBSY on Linux.
      const tmpFile = `${bin.path}.${randomUUID()}.download`
      try {
        const outputStream = createFileWriteStream(tmpFile)
        await bin.processResponse(responseStream, outputStream)
        await chmod(tmpFile, 0o775)
        await moveIntoPlace(bin, tmpFile)
      } finally {
        await removeFile(tmpFile)
      }
    },
    async () => {},
    2,
  )
}

async function moveIntoPlace(bin: DownloadableBinary, tmpFile: string) {
  try {
    await renameFile(tmpFile, bin.path)
  } catch (error) {
    // Windows refuses to replace a binary that another CLI process is running. Downloads rename only complete
    // binaries into place, so the existing one can be used.
    if (await fileExists(bin.path)) {
      outputDebug(`Using the ${bin.name} binary that another process downloaded to ${bin.path}`)
      return
    }
    throw error
  }
}

async function gunzipResponse(responseStream: PipelineSource<unknown>, outputStream: fs.WriteStream): Promise<void> {
  const gunzip = gzip.createGunzip()
  await stream.pipeline(responseStream, gunzip, outputStream)
}
