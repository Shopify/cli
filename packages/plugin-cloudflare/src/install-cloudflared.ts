// Install script for cloudflared, derived from https://github.com/JacobLinCool/node-cloudflared
import {basename, dirname, joinPath} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {
  chmod,
  fileExistsSync,
  mkdirSync,
  renameFile,
  unlinkFileSync,
  createFileWriteStream,
} from '@shopify/cli-kit/node/fs'
import {fileURLToPath} from 'url'
import util from 'util'
import {pipeline} from 'stream'
// eslint-disable-next-line no-restricted-imports
import {execSync, execFileSync} from 'child_process'

export const CURRENT_CLOUDFLARE_VERSION = '2024.2.1'
const CLOUDFLARE_REPO = `https://github.com/cloudflare/cloudflared/releases/download/${CURRENT_CLOUDFLARE_VERSION}/`

const LINUX_URL: {[key: string]: string} = {
  arm64: 'cloudflared-linux-arm64',
  arm: 'cloudflared-linux-arm',
  x64: 'cloudflared-linux-amd64',
  ia32: 'cloudflared-linux-386',
}

const MACOS_URL: {[key: string]: string} = {
  arm64: 'cloudflared-darwin-amd64.tgz',
  x64: 'cloudflared-darwin-amd64.tgz',
}

const WINDOWS_URL: {[key: string]: string} = {
  x64: 'cloudflared-windows-amd64.exe',
  ia32: 'cloudflared-windows-386.exe',
  arm64: 'cloudflared-windows-amd64.exe',
}

const URL: {[key: string]: {[key: string]: string}} = {
  linux: LINUX_URL,
  darwin: MACOS_URL,
  win32: WINDOWS_URL,
}

function getURL(platform = process.platform, arch = process.arch) {
  const keys = Object.keys(URL)
  if (!keys.includes(platform)) throw new Error(`Unsupported system platform: ${platform}`)

  const fileName = URL[platform]![arch]
  if (fileName === undefined) {
    throw new Error(`Unsupported system arch: ${arch}`)
  }
  return CLOUDFLARE_REPO + fileName
}

/**
 * Get the path where the binary should be installed.
 * If the environment variable SHOPIFY_CLI_CLOUDFLARED_PATH is set, use that.
 */
function getBinPathTarget(env = process.env, platform = process.platform) {
  if (env.SHOPIFY_CLI_CLOUDFLARED_PATH) {
    return env.SHOPIFY_CLI_CLOUDFLARED_PATH
  }
  return joinPath(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'bin',
    platform === 'win32' ? 'cloudflared.exe' : 'cloudflared',
  )
}

export default async function install(env = process.env, platform = process.platform, arch = process.arch) {
  if (env.SHOPIFY_CLI_IGNORE_CLOUDFLARED) {
    outputDebug('Skipping cloudflared installation because SHOPIFY_CLI_IGNORE_CLOUDFLARED is set')
    return
  }

  const fileUrlPath = getURL(platform, arch)
  const binTarget = getBinPathTarget(env, platform)

  if (fileExistsSync(binTarget)) {
    // --version returns an string like "cloudflared version 2023.3.1 (built 2023-03-13-1444 UTC)"
    try {
      const versionArray = execFileSync(binTarget, ['--version'], {encoding: 'utf8'}).split(' ')
      const versionNumber = versionArray.length > 2 ? versionArray[2] : '0.0.0'
      const needsUpdate = versionIsGreaterThan(CURRENT_CLOUDFLARE_VERSION, versionNumber!)
      if (!needsUpdate) {
        outputDebug('cloudflared already installed, skipping')
        return
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      outputDebug('version check failed, reinstalling')
    }
  }

  if (platform === 'linux') {
    await installLinux(fileUrlPath, binTarget)
  } else if (platform === 'darwin') {
    await installMacos(fileUrlPath, binTarget)
  } else if (platform === 'win32') {
    await installWindows(fileUrlPath, binTarget)
  } else {
    throw new Error(`Unsupported platform: ${platform}`)
  }
}

export function versionIsGreaterThan(versionA: string, versionB: string) {
  const [majorA, minorA, patchA] = versionA.split('.').map(Number)
  const [majorB, minorB, patchB] = versionB.split('.').map(Number)

  // Compare major versions
  if (majorA !== majorB) return (majorA ?? 0) > (majorB ?? 0)

  // If major versions are equal, compare minor versions
  if (minorA !== minorB) return (minorA ?? 0) > (minorB ?? 0)

  // If minor versions are also equal, compare patch versions
  return (patchA ?? 0) > (patchB ?? 0)
}

async function installLinux(file: string, binTarget: string) {
  await downloadFile(file, binTarget)
  await chmod(binTarget, '755')
}

async function installWindows(file: string, binTarget: string) {
  await downloadFile(file, binTarget)
}

async function installMacos(file: string, binTarget: string) {
  await downloadFile(file, `${binTarget}.tgz`)
  const filename = basename(`${binTarget}.tgz`)
  execSync(`tar -xzf ${filename}`, {cwd: dirname(binTarget)})
  unlinkFileSync(`${binTarget}.tgz`)
  await renameFile(`${dirname(binTarget)}/cloudflared`, binTarget)
}

async function downloadFile(url: string, to: string) {
  if (!fileExistsSync(dirname(to))) {
    mkdirSync(dirname(to))
  }
  const streamPipeline = util.promisify(pipeline)
  const response = await fetch(url, {redirect: 'follow'})
  if (!response.ok || !response.body)
    throw new Error(`Couldn't download file ${url} (${response.status} ${response.statusText})`)
  const fileObject = createFileWriteStream(to)
  await streamPipeline(response.body, fileObject)
  return to
}
