import {versions} from '../../constants'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import {http, file, path, os, error} from '@shopify/cli-kit'
import {createWriteStream, chmodSync, rmSync, promises as fs} from 'node:fs'
import {pipeline} from 'node:stream'
import {promisify} from 'node:util'
import {fileURLToPath} from 'url'

const streamPipeline = promisify(pipeline)

const SUPPORTED_SYSTEMS = ['darwin amd64', 'darwin arm64', 'linux 386', 'linux amd64', 'windows 386', 'windows amd64']
const RELEASE_DOWNLOADS_URL = 'https://github.com/Shopify/shopify-cli-extensions/releases/download'

async function vendorDir() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const dir = path.resolve(__dirname, '../vendor')
  if (!(await file.exists(vendorDir))) await file.mkdir(dir)
  return dir
}

async function downloadExecutable({processingDir, releaseAsset}) {
  const assetDownloadUrl = releaseUrlForAsset(releaseAsset, 'gz')
  const response = await http.fetch(assetDownloadUrl)
  const outFile = path.join(processingDir, releaseAsset)
  await streamPipeline(response.body, zlib.createGunzip(), createWriteStream(outFile))

  const md5DownloadUrl = releaseUrlForAsset(releaseAsset, 'md5')
  await validateChecksum(outFile, md5DownloadUrl)

  const finalPath = path.join(await vendorDir(), releaseAsset)
  await file.move(outFile, finalPath, {overwrite: true})
  await chmodSync(finalPath, 0o755)
}

// const processingDir = await file.mkTmpDir()
// try {
//   await downloadExecutable({processingDir, releaseAsset})
// } finally {
//   await file.rmdir(processingDir)
// }

export async function downloadIfNeeded(): Promise<string> {
  const {platform, arch} = os.platformAndArch()
  if (!SUPPORTED_SYSTEMS.includes(`${platform} ${arch}`)) {
    throw new error.Abort(`Unsupported platform: ${platform} ${arch}`)
  }
  let releaseAsset = `shopify-extensions-${platform}-${arch}`
  if (platform === 'windows') releaseAsset += '.exe'
}

function releaseUrlForAsset(releaseAsset: string, extension: string) {
  return `${RELEASE_DOWNLOADS_URL}/${versions.extensionsBinary}/${releaseAsset}.${extension}`
}

async function validateChecksum(fileToValidate: string, md5DownloadUrl: string) {
  const data = await fs.readFile(fileToValidate)
  const md5Digest = crypto.createHash('MD5').update(data).digest('hex')
  const md5Response = await http.fetch(md5DownloadUrl)
  const md5Contents = await md5Response.text()
  const canonicalMD5 = md5Contents.split(' ')[0]
  if (!(canonicalMD5 === md5Digest)) {
    throw new error.Abort(`Could not validate checksum! (found ${md5Digest}, should have received ${canonicalMD5})`)
  }
}
