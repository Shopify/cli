import {ThemeExtension} from '../../models/app/app'
import {error, file, path} from '@shopify/cli-kit'

interface ThemeExtensionConfig {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  theme_extension: {
    files: {[key: string]: string}
  }
}

const kilobytes = 1024
const megabytes = kilobytes * 1024

const SUPPORTED_BUCKETS = ['assets', 'blocks', 'snippets', 'locales']
const BUNDLE_SIZE_LIMIT_MB = 10
const BUNDLE_SIZE_LIMIT = BUNDLE_SIZE_LIMIT_MB * megabytes
const LIQUID_SIZE_LIMIT_KB = 100
const LIQUID_SIZE_LIMIT = LIQUID_SIZE_LIMIT_KB * kilobytes
const SUPPORTED_ASSET_EXTS = ['.jpg', '.js', '.css', '.png', '.svg']
const SUPPORTED_LOCALE_EXTS = ['.json']

export async function themeExtensionConfig(themeExtension: ThemeExtension): Promise<ThemeExtensionConfig> {
  const files: {[key: string]: string} = {}
  const themeFiles = await path.glob(path.join(themeExtension.directory, '*/*'))
  const liquidBytes: number[] = []
  const extensionBytes: number[] = []
  await Promise.all(
    themeFiles.map(async (filepath) => {
      const relativePath = path.relative(themeExtension.directory, filepath)
      const dirname = path.dirname(filepath)
      const filesize = await file.size(filepath)
      extensionBytes.push(filesize)
      if (['blocks', 'snippets'].includes(dirname)) liquidBytes.push(filesize)
      const encoding = dirname === 'assets' ? 'binary' : 'utf8'
      const fileContents = await file.read(filepath, {encoding})
      files[relativePath] = Buffer.from(fileContents).toString('base64')
    }),
  )
  const extensionBytesTotal = arraySum(extensionBytes)
  if (extensionBytesTotal > BUNDLE_SIZE_LIMIT) {
    const humanBundleSize = `${(extensionBytesTotal / megabytes).toFixed(2)} MB`
    throw new error.Abort(
      `Your theme app extension exceeds the file size limit (${BUNDLE_SIZE_LIMIT_MB} MB). It's currently ${humanBundleSize}.`,
      `Reduce your total file size and try again.`,
    )
  }
  const liquidBytesTotal = arraySum(liquidBytes)
  if (liquidBytesTotal > LIQUID_SIZE_LIMIT) {
    const humanLiquidSize = `${(liquidBytesTotal / kilobytes).toFixed(2)} kB`
    throw new error.Abort(
      `Your theme app extension exceeds the total liquid file size limit (${LIQUID_SIZE_LIMIT_KB} kB). It's currently ${humanLiquidSize}.`,
      `Reduce your total file size and try again.`,
    )
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  return {theme_extension: {files}}
}

function arraySum(array: number[]): number {
  return array.reduce((num1, num2) => num1 + num2, 0)
}
