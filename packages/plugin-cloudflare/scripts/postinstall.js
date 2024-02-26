// Install script for cloudflared, derived from https://github.com/JacobLinCool/node-cloudflared
import * as path from 'path'
import {fileURLToPath} from 'url'
import util from 'util'
import {pipeline} from 'stream'
import {execSync, execFileSync} from 'child_process'
import {createHash} from 'node:crypto'
import {chmodSync, existsSync, mkdirSync, renameSync, unlinkSync, createWriteStream, readFileSync} from 'fs'

const EXPECTED_CLOUDFLARE_VERSION = '2024.2.1'
const CLOUDFLARE_REPO = `https://github.com/cloudflare/cloudflared/releases/download/${EXPECTED_CLOUDFLARE_VERSION}/`

const LINUX_URL = {
  arm64: 'cloudflared-linux-arm64',
  arm: 'cloudflared-linux-arm',
  x64: 'cloudflared-linux-amd64',
  ia32: 'cloudflared-linux-386',
}

const MACOS_URL = {
  arm64: 'cloudflared-darwin-amd64.tgz',
  x64: 'cloudflared-darwin-amd64.tgz',
}

const WINDOWS_URL = {
  x64: 'cloudflared-windows-amd64.exe',
  ia32: 'cloudflared-windows-386.exe',
  arm64: 'cloudflared-windows-amd64.exe',
}

const URL = {
  linux: LINUX_URL[process.arch],
  darwin: MACOS_URL[process.arch],
  win32: WINDOWS_URL[process.arch],
}

/**
 * Get the path where the binary should be installed.
 * If the environment variable SHOPIFY_CLI_CLOUDFLARED_PATH is set, use that.
 */
function getBinPathTarget() {
  if (process.env.SHOPIFY_CLI_CLOUDFLARED_PATH) {
    return process.env.SHOPIFY_CLI_CLOUDFLARED_PATH
  }
  return path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'bin',
    process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared',
  )
}

export default async function install() {
  // Don't install cloudflare if the SHOPIFY_CLI_IGNORE_CLOUDFLARED environment variable is set
  if (process.env.SHOPIFY_CLI_IGNORE_CLOUDFLARED) return
  const [major, minor, patch] = process.versions.node.split('.').map(Number)
  // Fetch API is not available for <18. Added this check because our release process uses node 16.
  if (major < 18) return

  const fileName = URL[process.platform]
  if (fileName === undefined) {
    throw new Error(`Unsupported system platform: ${process.platform} or arch: ${process.arch}`)
  }

  const fileUrlPath = CLOUDFLARE_REPO + fileName
  const binTarget = getBinPathTarget()

  if (existsSync(binTarget)) {
    // --version returns an string like "cloudflared version 2023.3.1 (built 2023-03-13-1444 UTC)"
    try {
      const versionArray = execFileSync(binTarget, ['--version'], {encoding: 'utf8'}).split(' ')
      const versionNumber = versionArray.length > 2 ? versionArray[2] : '0.0.0'
      const needsUpdate = versionIsGreaterThan(EXPECTED_CLOUDFLARE_VERSION, versionNumber)
      if (!needsUpdate) {
        console.log('cloudflared already installed, skipping')
        return
      }
    } catch {
      console.log('version check failed, reinstalling')
    }
  }

  if (process.platform === 'linux') {
    await installLinux(fileUrlPath, binTarget)
  } else if (process.platform === 'darwin') {
    await installMacos(fileUrlPath, binTarget)
  } else if (process.platform === 'win32') {
    await installWindows(fileUrlPath, binTarget)
  } else {
    throw new Error(`Unsupported platform: ${process.platform}`)
  }
}

function versionIsGreaterThan(versionA, versionB) {
  const [majorA, minorA, patchA] = versionA.split('.').map(Number)
  const [majorB, minorB, patchB] = versionB.split('.').map(Number)

  // Compare major versions
  if (majorA !== majorB) return majorA > majorB

  // If major versions are equal, compare minor versions
  if (minorA !== minorB) return minorA > minorB

  // If minor versions are also equal, compare patch versions
  return patchA > patchB
}

async function installLinux(file, binTarget) {
  await downloadFile(file, binTarget)
  chmodSync(binTarget, '755')
}

async function installWindows(file, binTarget) {
  await downloadFile(file, binTarget)
}

async function installMacos(file, binTarget) {
  await downloadFile(file, `${binTarget}.tgz`)
  const filename = path.basename(`${binTarget}.tgz`)
  execSync(`tar -xzf ${filename}`, {cwd: path.dirname(binTarget)})
  unlinkSync(`${binTarget}.tgz`)
  renameSync(`${path.dirname(binTarget)}/cloudflared`, binTarget)
}

async function downloadFile(url, to) {
  if (!existsSync(path.dirname(to))) {
    mkdirSync(path.dirname(to))
  }
  const streamPipeline = util.promisify(pipeline)
  const response = await fetch(url, {redirect: 'follow'})
  if (!response.ok) throw new Error(`Couldn't download file ${url} (${response.status} ${response.statusText})`)
  const fileObject = createWriteStream(to)
  await streamPipeline(response.body, fileObject)
  return to
}

function sha256(filePath) {
  const fileBuffer = readFileSync(filePath)
  return createHash('sha256').update(fileBuffer).digest('hex')
}

install().catch((err) => {
  throw err
})
