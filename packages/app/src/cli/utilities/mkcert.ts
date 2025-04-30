import {environmentVariableNames} from '../constants.js'
import {generateCertificatePrompt} from '../prompts/dev.js'
import {exec} from '@shopify/cli-kit/node/system'
import {downloadGitHubFile, downloadGitHubRelease} from '@shopify/cli-kit/node/github'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import which from 'which'
import {renderTasks} from '@shopify/cli-kit/node/ui'

const MKCERT_VERSION = 'v1.4.4'
const MKCERT_REPO = 'FiloSottile/mkcert'
const mkcertSnippet = outputToken.genericShellCommand('mkcert')

/**
 * Gets the path to the mkcert binary.
 *
 * 1. If the path is set in the enviroment variables, it return that path.  Otherwise it will be appDirectory/.shopify/mkcert
 * 2. Downloads the mkcert binary to appDirectory/.shopify/mkcert if it doesn't exist
 * 3. Downloads the mkcert LICENSE to appDirectory/.shopify/mkcert-LICENSE if it doesn't exist
 *
 */
async function getMkcertPath(
  appDirectory: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
): Promise<string> {
  const envPath = env[environmentVariableNames.mkcertBinaryPath]

  if (envPath) return envPath

  const binaryName = platform === 'win32' ? 'mkcert.exe' : 'mkcert'
  const dotShopifyPath = joinPath(appDirectory, '.shopify')
  const defaultMkcertPath = joinPath(dotShopifyPath, binaryName)
  const downloadLicensePromise = downloadMkcertLicense(dotShopifyPath)

  if (await fileExists(defaultMkcertPath)) {
    await downloadLicensePromise
    return defaultMkcertPath
  }

  const mkcertLocation = await which('mkcert', {nothrow: true})
  if (mkcertLocation) {
    outputDebug(outputContent`Found ${mkcertSnippet} at ${outputToken.path(mkcertLocation)}`)
    await downloadLicensePromise
    return mkcertLocation
  }

  await downloadMkcert(defaultMkcertPath, platform, arch)
  await downloadLicensePromise

  return defaultMkcertPath
}

/**
 * Downloads the mkcert binary for the specified platform and architecture
 * File is downloaded to the target path
 * If the file already exists, it won't be downloaded again
 */
async function downloadMkcert(targetPath: string, platform: NodeJS.Platform, arch: NodeJS.Architecture): Promise<void> {
  let assetName: string

  switch (platform) {
    case 'darwin':
      assetName = arch === 'arm64' ? `mkcert-${MKCERT_VERSION}-darwin-arm64` : `mkcert-${MKCERT_VERSION}-darwin-amd64`
      break
    case 'linux':
      assetName = arch === 'arm64' ? `mkcert-${MKCERT_VERSION}-linux-arm64` : `mkcert-${MKCERT_VERSION}-linux-amd64`
      break
    case 'win32':
      assetName = `mkcert-${MKCERT_VERSION}-windows-amd64.exe`
      break
    default:
      throw new BugError(`Unsupported platform: ${platform}`)
  }

  await downloadGitHubRelease(MKCERT_REPO, MKCERT_VERSION, assetName, targetPath)

  outputDebug(outputContent`${mkcertSnippet} saved to ${outputToken.path(targetPath)}`)
}

/**
 * Downloads the mkcert LICENSE file to the specified directory
 * If the file already exists, it won't be downloaded again
 * If the download fails, it will log the error but not throw
 *
 * @param dotShopifyPath - The .shopify directory path
 */
async function downloadMkcertLicense(dotShopifyPath: string): Promise<void> {
  const licensePath = joinPath(dotShopifyPath, 'mkcert-LICENSE')

  if (await fileExists(licensePath)) return

  await downloadGitHubFile(MKCERT_REPO, MKCERT_VERSION, 'LICENSE', licensePath, {
    throw: false,
  })
}

interface GenerateCertificateOptions {
  appDirectory: string
  resetFirst?: boolean
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  arch?: NodeJS.Architecture
}

/**
 * Generates a self-signed certificate for https://localhost via `mkcert`
 *
 * The `mkcert` binary may be hard-coded via {@link environmentVariableNames.mkcertBinaryPath}; found in
 * the app directory under `.shopify/mkcert`; or present on the system PATH.
 *
 * If the binary can't be found, it's downloaded from Github and stored in the app directory.
 *
 * @returns Contents of the key and certificate files
 */
export async function generateCertificate({
  appDirectory,
  env = process.env,
  platform = process.platform,
  arch = process.arch,
}: GenerateCertificateOptions): Promise<{keyContent: string; certContent: string; certPath: string}> {
  const relativeKeyPath = joinPath('.shopify', 'localhost-key.pem')
  const relativeCertPath = joinPath('.shopify', 'localhost.pem')
  const keyPath = joinPath(appDirectory, relativeKeyPath)
  const certPath = joinPath(appDirectory, relativeCertPath)

  if ((await fileExists(keyPath)) && (await fileExists(certPath))) {
    return {
      keyContent: await readFile(keyPath),
      certContent: await readFile(certPath),
      certPath: relativeCertPath,
    }
  }

  const shouldGenerate = await generateCertificatePrompt()

  if (!shouldGenerate) {
    throw new AbortError(`Localhost certificate and key are required at ${relativeCertPath} and ${relativeKeyPath}`)
  }

  let mkcertPath = ''

  const taskList = []
  taskList.push({
    title: 'Finding or downloading mkcert binary',
    task: async () => {
      mkcertPath = await getMkcertPath(appDirectory, env, platform, arch)
      outputDebug(outputContent`${mkcertSnippet} found at: ${outputToken.path(mkcertPath)}`)
    },
  })
  await renderTasks(taskList)

  outputInfo(outputContent`Generating self-signed certificate for localhost. You may be prompted for your password.`)
  await exec(mkcertPath, ['-install', '-key-file', keyPath, '-cert-file', certPath, 'localhost'])
  outputInfo(outputContent`${outputToken.successIcon()} Certificate generated at ${relativeCertPath}\n`)

  return {
    keyContent: await readFile(keyPath),
    certContent: await readFile(certPath),
    certPath: relativePath(appDirectory, certPath),
  }
}
