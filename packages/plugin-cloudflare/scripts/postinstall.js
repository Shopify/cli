// Install script for cloudflared, derived from https://github.com/JacobLinCool/node-cloudflared
import * as path from 'path'
import {fileURLToPath} from 'url'
import util from 'util'
import {pipeline} from 'stream'
import {execSync, execFileSync} from 'child_process'
import {createHash} from 'node:crypto'
import {chmodSync, existsSync, mkdirSync, renameSync, unlinkSync, createWriteStream, readFileSync} from 'fs'
import fetch from 'node-fetch'
import semver from 'semver'

const CLOUDFLARE_VERSION = '2023.3.1'
const CLOUDFLARE_REPO = `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARE_VERSION}/`

const LINUX_URL = {
  arm64: {
    filename: 'cloudflared-linux-arm64',
    checksum: '1989edb5244fcbb8420a94655b2193f9c103758418e7ddaea7b7a63852993135',
  },
  arm: {
    filename: 'cloudflared-linux-arm',
    checksum: '6fb2ec9241e7e6927b9ceddbbc2442714e0245f25882fadb5ce073c672e2d7c5',
  },
  x64: {
    filename: 'cloudflared-linux-amd64',
    checksum: '72a750d7a043b2ae291470710fafa816ab104a60120ec6721d7c1fbbf24c8558',
  },
  ia32: {
    filename: 'cloudflared-linux-386',
    checksum: '5f361084c2c0ceba4b5287566f192069d40da8c7ae74ce14d6902d65607bbe92',
  },
}

const MACOS_URL = {
  arm64: {
    filename: 'cloudflared-darwin-amd64.tgz',
    checksum: '90b515a036306e6ddd15e8558e029fef879cad88a936f9409c546de50cd7dd7a',
  },
  x64: {
    filename: 'cloudflared-darwin-amd64.tgz',
    checksum: '90b515a036306e6ddd15e8558e029fef879cad88a936f9409c546de50cd7dd7a',
  },
}

const WINDOWS_URL = {
  x64: {
    filename: 'cloudflared-windows-amd64.exe',
    checksum: 'bb67c7623ba92fe64ffd9816b8d5b3b1ea3013960a30bd4cf6e295b3eb5b1bad',
  },
  ia32: {
    filename: 'cloudflared-windows-386.exe',
    checksum: 'd2513e58bb03ccc83affde685c6ef987924c37ce6707d8e9857e2524b0d7e90f',
  },
}

const URL = {
  linux: CLOUDFLARE_REPO + LINUX_URL[process.arch]?.filename,
  darwin: CLOUDFLARE_REPO + MACOS_URL[process.arch]?.filename,
  win32: CLOUDFLARE_REPO + WINDOWS_URL[process.arch]?.filename,
}

const CHECKSUM = {
  linux: LINUX_URL[process.arch]?.checksum,
  darwin: MACOS_URL[process.arch]?.checksum,
  win32: WINDOWS_URL[process.arch]?.checksum,
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
  const fileUrlPath = URL[process.platform]
  if (fileUrlPath === undefined) {
    throw new Error(`Unsupported system platform: ${process.platform} or arch: ${process.arch}`)
  }

  const binTarget = getBinPathTarget()

  if (existsSync(binTarget)) {
    // --version returns an string like "cloudflared version 2023.3.1 (built 2023-03-13-1444 UTC)"
    const versionArray = execFileSync(binTarget, ['--version'], {encoding: 'utf8'}).split(' ')
    const versionNumber = versionArray.length > 2 ? versionArray[2] : '0.0.0'
    const needsUpdate = semver.gt(CLOUDFLARE_VERSION, versionNumber)
    if (!needsUpdate) {
      console.log('cloudflared already installed, skipping')
      return
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

async function installLinux(file, binTarget) {
  await downloadFile(file, binTarget)
  if (sha256(binTarget) !== CHECKSUM.linux) throw new Error('Checksum mismatch')
  chmodSync(binTarget, '755')
}

async function installWindows(file, binTarget) {
  await downloadFile(file, binTarget)
  if (sha256(binTarget) !== CHECKSUM.win32) throw new Error('Checksum mismatch')
}

async function installMacos(file, binTarget) {
  await downloadFile(file, `${binTarget}.tgz`)
  const filename = path.basename(`${binTarget}.tgz`)
  execSync(`tar -xzf ${filename}`, {cwd: path.dirname(binTarget)})
  unlinkSync(`${binTarget}.tgz`)
  renameSync(`${path.dirname(binTarget)}/cloudflared`, binTarget)
  if (sha256(binTarget) !== CHECKSUM.darwin) throw new Error('Checksum mismatch')
}

async function downloadFile(url, to) {
  if (!existsSync(path.dirname(to))) {
    mkdirSync(path.dirname(to))
  }
  const streamPipeline = util.promisify(pipeline)
  const response = await fetch(url, {redirect: 'follow'})
  if (!response.ok) throw new Error("Couldn't download file")
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
