import {environmentVariableNames} from '../constants.js'
import {exec} from '@shopify/cli-kit/node/system'
import {downloadGitHubRelease} from '@shopify/cli-kit/node/github'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, readFile, removeFile} from '@shopify/cli-kit/node/fs'
import {outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import which from 'which'

const MKCERT_VERSION = 'v1.4.4'
const MKCERT_REPO = 'FiloSottile/mkcert'
const mkcertSnippet = outputToken.genericShellCommand('mkcert')

async function getMkcertPath(
  appDirectory: string,
  onRequiresDownload: () => Promise<boolean>,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
): Promise<string> {
  const envPath = env[environmentVariableNames.mkcertBinaryPath]
  if (envPath) return envPath

  const binaryName = platform === 'win32' ? 'mkcert.exe' : 'mkcert'

  const defaultPath = joinPath(appDirectory, '.shopify', binaryName)
  if (await fileExists(defaultPath)) return defaultPath

  // Check if mkcert is available on the system PATH
  const mkcertLocation = await which('mkcert', {nothrow: true})
  if (mkcertLocation) {
    outputDebug(
      outputContent`${outputToken.successIcon()} Found ${mkcertSnippet} at ${outputToken.path(mkcertLocation)}`,
    )
    return mkcertLocation
  }

  const shouldDownload = await onRequiresDownload()

  if (!shouldDownload) {
    throw new AbortError(
      'mkcert is required. Please provide its path using SHOPIFY_CLI_MKCERT_BINARY environment variable.',
    )
  }

  await downloadMkcert(defaultPath, platform, arch)
  return defaultPath
}

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

  outputInfo(outputContent`${outputToken.successIcon()} ${mkcertSnippet} saved to ${outputToken.path(targetPath)}`)
}

interface GenerateCertificateOptions {
  appDirectory: string
  onRequiresDownloadConfirmation: () => Promise<boolean>
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
  onRequiresDownloadConfirmation,
  resetFirst = false,
  env = process.env,
  platform = process.platform,
  arch = process.arch,
}: GenerateCertificateOptions): Promise<{keyContent: string; certContent: string}> {
  // if we're resetting, delete the .shopify/mkcert file, if it exists
  if (resetFirst) {
    const mkcertPath = joinPath(appDirectory, '.shopify', 'mkcert')
    if (await fileExists(mkcertPath)) {
      outputDebug(
        outputContent`${outputToken.failIcon()} Removing existing ${mkcertSnippet} binary at ${outputToken.path(
          mkcertPath,
        )}`,
      )
      await removeFile(mkcertPath)
    }
  }

  const mkcertPath = await getMkcertPath(appDirectory, onRequiresDownloadConfirmation, env, platform, arch)
  outputDebug(outputContent`${mkcertSnippet} found at: ${outputToken.path(mkcertPath)}`)

  // in reset mode, clear the installed CA first
  if (resetFirst) {
    outputInfo(outputContent`🔄 Uninstalling ${mkcertSnippet} root certificate...`)
    // this call is allowed to fail if the CA isn't installed
    await exec(mkcertPath, ['-uninstall']).catch(() => {})
  }

  const keyPath = joinPath(appDirectory, '.shopify', 'localhost-key.pem')
  const certPath = joinPath(appDirectory, '.shopify', 'localhost.pem')

  outputInfo(outputContent`🔐 Checking ${mkcertSnippet} root certificate. You may be prompted for your password.`)
  await exec(mkcertPath, ['-install', '-key-file', keyPath, '-cert-file', certPath, 'localhost'])
  outputInfo(outputContent`${outputToken.successIcon()} ${mkcertSnippet} is installed`)

  return {keyContent: await readFile(keyPath), certContent: await readFile(certPath)}
}
