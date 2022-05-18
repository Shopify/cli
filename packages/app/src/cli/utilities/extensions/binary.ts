import {versions} from '../../constants'
import {http, file, path, os, error, checksum, constants} from '@shopify/cli-kit'
import zlib from 'node:zlib'
import {createWriteStream} from 'node:fs'
import {pipeline} from 'node:stream'
import {promisify} from 'node:util'

const SUPPORTED_SYSTEMS = ['darwin amd64', 'darwin arm64', 'linux 386', 'linux amd64', 'windows 386', 'windows amd64']
const RELEASE_DOWNLOADS_URL = 'https://github.com/Shopify/shopify-cli-extensions/releases/download'

export const UnsupportedPlatformError = ({platform, arch}: {platform: string; arch: string}) => {
  return new error.Abort(
    `The current platform ${platform} and architecture ${arch} are not supported for extensions development.`,
  )
}

export async function getBinaryPathOrDownload(): Promise<string> {
  // Return the path if it already exists
  const binaryLocalPath = await getBinaryLocalPath()
  if (await binaryExists()) {
    return binaryLocalPath
  }
  const {platform, arch} = os.platformAndArch()
  validatePlatformSupport({platform, arch})

  let artifact = `shopify-extensions-${platform}-${arch}`
  if (platform === 'windows') artifact += '.exe'

  return file.inTemporaryDirectory(async (tmpDir) => {
    const outputBinary = await download({into: tmpDir, artifact})
    await file.mkdir(path.join(path.dirname(outputBinary)))
    await file.move(outputBinary, binaryLocalPath, {overwrite: true})
    await file.chmod(binaryLocalPath, 0o755)
    return binaryLocalPath
  })
}

async function download({into, artifact}: {into: string; artifact: string}): Promise<string> {
  const assetDownloadUrl = getReleaseArtifactURL({
    name: artifact,
    extension: 'gz',
  })
  const response = await http.fetch(assetDownloadUrl)
  const outputBinary = path.join(into, artifact)
  await promisify(pipeline)(response.body as any, zlib.createGunzip(), createWriteStream(outputBinary))

  const md5DownloadUrl = getReleaseArtifactURL({
    name: artifact,
    extension: 'md5',
  })
  await checksum.validateMD5({file: outputBinary, md5FileURL: md5DownloadUrl})
  return outputBinary
}

export function getReleaseArtifactURL({name, extension}: {name: string; extension: string}) {
  return `${RELEASE_DOWNLOADS_URL}/${versions.extensionsBinary}/${name}.${extension}`
}

export function validatePlatformSupport({platform, arch}: {platform: string; arch: string}) {
  if (!SUPPORTED_SYSTEMS.includes(`${platform} ${arch}`)) {
    throw UnsupportedPlatformError({
      platform,
      arch,
    })
  }
}

export async function ensureBinaryDirectoryExists(): Promise<void> {
  const binaryPath = await getBinaryLocalPath()
  await file.mkdir(path.dirname(binaryPath))
}

export async function binaryExists(): Promise<boolean> {
  const binaryPath = await getBinaryLocalPath()
  return file.exists(binaryPath)
}

export async function getBinaryLocalPath(): Promise<string> {
  const {platform, arch} = os.platformAndArch()
  const binariesDirectory = constants.paths.directories.cache.vendor.binaries()
  const extensionsDirectory = path.join(binariesDirectory, 'extensions')
  let binaryName = `${versions.extensionsBinary}-${platform}-${arch}`
  if (platform === 'windows') {
    binaryName += '.exe'
  }
  return path.join(extensionsDirectory, binaryName)
}
