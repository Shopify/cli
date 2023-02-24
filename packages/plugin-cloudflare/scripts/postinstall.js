// Install script for cloudflared, derived from https://github.com/JacobLinCool/node-cloudflared
import * as path from 'path'
import {fileURLToPath} from 'url'
import util from 'util'
import {pipeline} from 'stream'
import {execSync} from 'child_process'
import {createHash} from 'node:crypto'
import {chmodSync, existsSync, mkdirSync, renameSync, unlinkSync, createWriteStream, readFileSync} from 'fs'
import fetch from "node-fetch"

const CLOUDFLARE_VERSION = '2023.1.0'
const CLOUDFLARE_REPO = `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARE_VERSION}/`

const LINUX_URL = {
  arm64: {
    filename: 'cloudflared-linux-arm64',
    checksum: '38011f9a6b28b358c75cfff5eb72ed5209c6882ae5084eabad8f01c11a79946c',
  },
  arm: {
    filename: 'cloudflared-linux-arm',
    checksum: '072e8dd4565837b8185ce9017a07bbc781a2c26d343ac556c916b9ce2b533e82',
  },
  x64: {
    filename: 'cloudflared-linux-amd64',
    checksum: '7a12458b56e52d750a2d506b9e4de0035829898a6d80bab147d4964d784d9108',
  },
  ia32: {
    filename: 'cloudflared-linux-386',
    checksum: '1374ce7fb565cc5c2b0f9edae998fc88904db60b5ae7da646d289bda44b31b3f',
  },
}

const MACOS_URL = {
  arm64: {
    filename: 'cloudflared-darwin-amd64.tgz',
    checksum: '521ea7bd1a27f52316d2966da87b8f164636b69a0481072c03965eb07afaaf76',
  },
  x64: {
    filename: 'cloudflared-darwin-amd64.tgz',
    checksum: '521ea7bd1a27f52316d2966da87b8f164636b69a0481072c03965eb07afaaf76',
  },
}

const WINDOWS_URL = {
  x64: {
    filename: 'cloudflared-windows-amd64.exe',
    checksum: '19074674c6fbdaa573b3081745e5e26144fdf7a086d14e0e220d1814f1f13078',
  },
  ia32: {
    filename: 'cloudflared-windows-386.exe',
    checksum: '2fbbfc8299537ff80cadf9d0e27c223fe0ccb9052bf9d8763ad717bbfa521c77',
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
