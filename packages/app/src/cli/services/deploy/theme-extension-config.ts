import {ThemeExtension} from '../../models/app/app'
import {error, file, output, path} from '@shopify/cli-kit'
import {ExtensionTypesHumanKeys} from 'cli/constants'

export interface ThemeExtensionConfig {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  theme_extension: {
    files: {[key: string]: string}
  }
}

interface FilenameValidation {
  validator: RegExp
  failureMessage: (filename: string) => string
}

const kilobytes = 1024
const megabytes = kilobytes * 1024

const BUNDLE_SIZE_LIMIT_MB = 10
const BUNDLE_SIZE_LIMIT = BUNDLE_SIZE_LIMIT_MB * megabytes
const LIQUID_SIZE_LIMIT_KB = 100
const LIQUID_SIZE_LIMIT = LIQUID_SIZE_LIMIT_KB * kilobytes

const SUPPORTED_ASSET_EXTS = ['.jpg', '.js', '.css', '.png', '.svg']
const SUPPORTED_LOCALE_EXTS = ['.json']
const SUPPORTED_EXTS: {[dirname: string]: FilenameValidation} = {
  assets: {
    validator: new RegExp(`${SUPPORTED_ASSET_EXTS.join('|')}$`),
    failureMessage: (filename: string) =>
      `Only these filetypes are supported in assets: ${SUPPORTED_ASSET_EXTS.join(', ')}`,
  },
  blocks: {
    validator: /.liquid$/,
    failureMessage: (filename: string) => `Only .liquid files are allowed in blocks.`,
  },
  locales: {
    validator: new RegExp(`${SUPPORTED_LOCALE_EXTS.join('|')}$`),
    failureMessage: (filename: string) =>
      `Only these filetypes are supported in locales: ${SUPPORTED_LOCALE_EXTS.join(', ')}`,
  },
  snippets: {
    validator: /.liquid$/,
    failureMessage: (filename: string) => `Only .liquid files are allowed in snippets.`,
  },
}
const SUPPORTED_BUCKETS = Object.keys(SUPPORTED_EXTS)
const THEME_APP_EXTENSION_HUMAN_KEY: ExtensionTypesHumanKeys = 'theme app extension'

export async function themeExtensionConfig(themeExtension: ThemeExtension): Promise<ThemeExtensionConfig> {
  const files: {[key: string]: string} = {}
  const themeFiles = await path.glob(path.join(themeExtension.directory, '*/*'))
  const liquidBytes: number[] = []
  const extensionBytes: number[] = []
  await Promise.all(
    themeFiles.map(async (filepath) => {
      const relativePath = path.relative(themeExtension.directory, filepath)
      const dirname = path.dirname(relativePath)
      validateFile(relativePath, dirname)
      const filesize = await file.size(filepath)
      extensionBytes.push(filesize)
      if (['blocks', 'snippets'].includes(dirname)) liquidBytes.push(filesize)
      const encoding = dirname === 'assets' ? 'binary' : 'utf8'
      const fileContents = await file.read(filepath, {encoding})
      files[relativePath] = Buffer.from(fileContents, encoding).toString('base64')
    }),
  )
  const extensionBytesTotal = arraySum(extensionBytes)
  if (extensionBytesTotal > BUNDLE_SIZE_LIMIT) {
    const humanBundleSize = `${(extensionBytesTotal / megabytes).toFixed(2)} MB`
    throw new error.Abort(
      `Your ${THEME_APP_EXTENSION_HUMAN_KEY} exceeds the file size limit (${BUNDLE_SIZE_LIMIT_MB} MB). It's currently ${humanBundleSize}.`,
      `Reduce your total file size and try again.`,
    )
  }
  const liquidBytesTotal = arraySum(liquidBytes)
  if (liquidBytesTotal > LIQUID_SIZE_LIMIT) {
    const humanLiquidSize = `${(liquidBytesTotal / kilobytes).toFixed(2)} kB`
    throw new error.Abort(
      `Your ${THEME_APP_EXTENSION_HUMAN_KEY} exceeds the total liquid file size limit (${LIQUID_SIZE_LIMIT_KB} kB). It's currently ${humanLiquidSize}.`,
      `Reduce your total file size and try again.`,
    )
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  return {theme_extension: {files}}
}

function validateFile(filepath: string, dirname: string): void {
  if (!SUPPORTED_BUCKETS.includes(dirname)) {
    throw new error.Abort(
      output.content`Your ${THEME_APP_EXTENSION_HUMAN_KEY} includes files in an unsupported directory, ${output.token.path(
        dirname,
      )}`,
      `Make sure all ${THEME_APP_EXTENSION_HUMAN_KEY} files are in the supported directories: ${SUPPORTED_BUCKETS.join(
        ', ',
      )}`,
    )
  }
  const filenameValidation = SUPPORTED_EXTS[dirname]
  if (!filepath.match(filenameValidation.validator)) {
    throw new error.Abort(`Invalid filename in your ${THEME_APP_EXTENSION_HUMAN_KEY}: ${filepath}
${filenameValidation.failureMessage(filepath)}`)
  }
}

function arraySum(array: number[]): number {
  return array.reduce((num1, num2) => num1 + num2, 0)
}
