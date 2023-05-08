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

const CLOUDFLARE_VERSION = '2023.4.2'
const CLOUDFLARE_REPO = `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARE_VERSION}/`

const LINUX_URL = {
  arm64: {
    filename: 'cloudflared-linux-arm64',
    checksum: 'e453b576d0db95e4e9b7f511bb379f6b0b0a73924da678655875c2c295b95627',
  },
  arm: {
    filename: 'cloudflared-linux-arm',
    checksum: 'f3c4698aca3fff4f94a455cbf1f9c0e1cd81498e67d0decb73d63b6a41337f43',
  },
  x64: {
    filename: 'cloudflared-linux-amd64',
    checksum: '7e48b3d91f44badc1b4c2bd446ef1c4ae4c824840d594bd353cf20cba5fd1cef',
  },
  ia32: {
    filename: 'cloudflared-linux-386',
    checksum: '576955db7b44e1d997a22bb07eebb58001bd56956351142da504d80c07663153',
  },
}

const MACOS_URL = {
  arm64: {
    filename: 'cloudflared-darwin-amd64.tgz',
    checksum: '1154f3b2c31f4727c076c3e08024887be0e0a0b68a89e4f88f286f6f6196ac74',
  },
  x64: {
    filename: 'cloudflared-darwin-amd64.tgz',
    checksum: '1154f3b2c31f4727c076c3e08024887be0e0a0b68a89e4f88f286f6f6196ac74',
  },
}

const WINDOWS_URL = {
  x64: {
    filename: 'cloudflared-windows-amd64.exe',
    checksum: '53f8adbd76c0eb16f5e43cadde422474d8a06f9c8f959389c1930042ad8beaa5',
  },
  ia32: {
    filename: 'cloudflared-windows-386.exe',
    checksum: 'c2cfd23fdc6c0e1b1ffa0e545cbe556f18d11b362b4a89ba0713f6ab01c4827f',
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
