// Install script for cloudflared, derived from https://github.com/JacobLinCool/node-cloudflared
import * as path from 'path'
import {fileURLToPath} from 'url'
import util from 'util'
import {pipeline} from 'stream'
import {execSync} from 'child_process'
import {createHash} from 'node:crypto'
import {chmodSync, existsSync, mkdirSync, renameSync, unlinkSync, createWriteStream, readFileSync} from 'fs'
import fetch from 'node-fetch'

const CLOUDFLARE_VERSION = '2023.2.1'
const CLOUDFLARE_REPO = `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARE_VERSION}/`

const LINUX_URL = {
  arm64: {
    filename: 'cloudflared-linux-arm64',
    checksum: '03e8f22ad61465834154ccb8656d20eaf0a73789173e3c70fcabddb7f1b67fd1',
  },
  arm: {
    filename: 'cloudflared-linux-arm',
    checksum: '2fbe0c2eb438ffa8d0f459e7f41b2cf8c8f1bbe88a7362dd15b63380fd2777b5',
  },
  x64: {
    filename: 'cloudflared-linux-amd64',
    checksum: '41fa4fc3f43214c2121d1006d4cfffa9dc3b952b6cde3a79440d799de658d138',
  },
  ia32: {
    filename: 'cloudflared-linux-386',
    checksum: '38208ff59b6fc1b356b51ce4a0041f71abe739b89ccf7d7676e4b941f958f7ca',
  },
}

const MACOS_URL = {
  arm64: {
    filename: 'cloudflared-darwin-amd64.tgz',
    checksum: 'c58a66da2f153592c366262f5100539f54d3db9d0fd90262afc01f73be5f18f1',
  },
  x64: {
    filename: 'cloudflared-darwin-amd64.tgz',
    checksum: 'c58a66da2f153592c366262f5100539f54d3db9d0fd90262afc01f73be5f18f1',
  },
}

const WINDOWS_URL = {
  x64: {
    filename: 'cloudflared-windows-amd64.exe',
    checksum: 'd3a0e1a79158f3985cd49607ebe0cdfcc49cb9af96b8f43aefd0cdfe2f22e663',
  },
  ia32: {
    filename: 'cloudflared-windows-386.exe',
    checksum: 'd14c52d9220b606f428a8fe9f7c108b0d6f14cf71e7384749e98e6a95962e68f',
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
    console.log('cloudflared already installed, skipping')
    return
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
