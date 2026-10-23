import {createExtensionSpecification} from '../specification.js'
import {BaseSchema, CapabilitiesSchema} from '../schemas.js'
import {themeExtensionFiles} from '../../../utilities/extensions/theme.js'
import {ExtensionInstance} from '../extension-instance.js'
import {fileSize} from '@shopify/cli-kit/node/fs'
import {dirname, relativePath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {zod} from '@shopify/cli-kit/node/schema'

export const MAX_ALLOWED_SOURCES = 20
const MAX_HOST_LENGTH = 253
const DEFAULT_HTTPS_PORT = 443
const MAX_PORT = 65535
const ALLOWED_SOURCE_PATTERN = /^https:\/\/(\*\.)?([a-z0-9.-]+)(?::(\d{1,5}))?$/
const HOST_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Normalizes an `allowed_sources` entry to `https://[*.]host[:port]`.
 *
 * Entries are trimmed and lowercased, a single trailing slash is dropped, and the default `:443` port is removed.
 * The host needs at least two labels and can't be an IP address. Only a leading `*.` wildcard is allowed.
 *
 * @param source - The entry as written in `shopify.extension.toml`.
 * @returns The normalized origin, or `undefined` if the entry isn't a valid HTTPS origin.
 */
export function normalizeAllowedSource(source: string): string | undefined {
  const value = source.trim().toLowerCase().replace(/\/$/, '')
  const match = ALLOWED_SOURCE_PATTERN.exec(value)
  if (!match) return undefined

  const [, wildcard = '', host = '', port] = match
  if (host.length > MAX_HOST_LENGTH) return undefined

  const labels = host.split('.')
  if (labels.length < 2 || !labels.every((label) => HOST_LABEL_PATTERN.test(label))) return undefined
  // A numeric last label means an IP address (or a TLD that doesn't exist).
  if (/^\d+$/.test(labels[labels.length - 1]!)) return undefined

  let portSuffix = ''
  if (port !== undefined) {
    const portNumber = Number(port)
    if (portNumber < 1 || portNumber > MAX_PORT) return undefined
    if (portNumber !== DEFAULT_HTTPS_PORT) portSuffix = `:${portNumber}`
  }

  return `https://${wildcard}${host}${portSuffix}`
}

const AllowedSourcesSchema = zod
  .array(zod.string(), {
    required_error: 'allowed_sources is required. Use an empty list if your extension contacts no other origins.',
    invalid_type_error: 'allowed_sources must be a list of HTTPS origins, like ["https://api.example.com"]',
  })
  .superRefine((sources, ctx) => {
    const invalid = sources.filter((source) => normalizeAllowedSource(source) === undefined)
    if (invalid.length > 0) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: `Invalid allowed_sources: ${invalid.map((source) => JSON.stringify(source)).join(', ')}. Use HTTPS origins with no path, query or fragment, like "https://api.example.com" or "https://*.example-cdn.com".`,
      })
    }
  })
  .transform((sources) => [...new Set(sources.map((source) => normalizeAllowedSource(source)!))])
  .refine((sources) => sources.length <= MAX_ALLOWED_SOURCES, {
    message: `allowed_sources can list up to ${MAX_ALLOWED_SOURCES} origins`,
  })

const ThemeNetworkAccessSchema = zod.object(
  {allowed_sources: AllowedSourcesSchema},
  {invalid_type_error: 'network_access must be a table with an allowed_sources list for theme app extensions'},
)

const ThemeCapabilitiesSchema = CapabilitiesSchema.extend({
  // A boolean `network_access` (used by UI extensions) never had an effect on theme app extensions. Keep ignoring it.
  network_access: zod.preprocess(
    (value) => (typeof value === 'boolean' ? undefined : value),
    ThemeNetworkAccessSchema.optional(),
  ),
})

export const ThemeSchema = BaseSchema.extend({
  capabilities: ThemeCapabilitiesSchema.optional(),
})

const themeSpec = createExtensionSpecification({
  identifier: 'theme',
  schema: ThemeSchema,
  partnersWebIdentifier: 'theme_app_extension',
  graphQLType: 'theme_app_extension',
  clientSteps: [
    {
      lifecycle: 'deploy',
      steps: [
        {id: 'build-theme', name: 'Build Theme Extension', type: 'build_theme', config: {}},
        {id: 'bundle-theme', name: 'Bundle Theme Extension', type: 'bundle_theme', config: {}},
      ],
    },
  ],
  appModuleFeatures: (_) => {
    return ['theme']
  },
  deployConfig: async (config) => {
    const networkAccess = config.capabilities?.network_access
    // Only send capabilities when they're declared, so existing payloads stay the same.
    if (typeof networkAccess !== 'object') return {theme_extension: {files: {}}}

    return {
      theme_extension: {files: {}},
      capabilities: {network_access: {allowed_sources: networkAccess.allowed_sources}},
    }
  },
  preDeployValidation: async (extension) => {
    return validateThemeExtension(extension)
  },
})

export default themeSpec

// Theme extension validation helpers
interface FilenameValidation {
  validator: RegExp
  failureMessage: (filename: string) => string
}

const kilobytes = 1024
const megabytes = kilobytes * 1024

const BUNDLE_SIZE_LIMIT_MB = 10
const BUNDLE_SIZE_LIMIT = BUNDLE_SIZE_LIMIT_MB * megabytes
const LIQUID_SIZE_LIMIT_KB = 500
const LIQUID_SIZE_LIMIT = LIQUID_SIZE_LIMIT_KB * kilobytes

const SUPPORTED_ASSET_EXTS = ['.jpg', '.jpeg', '.json', '.js', '.css', '.png', '.svg', '.wasm']
const SUPPORTED_LOCALE_EXTS = ['.json']
const SUPPORTED_EXTS: {[dirname: string]: FilenameValidation} = {
  assets: {
    validator: new RegExp(`${SUPPORTED_ASSET_EXTS.join('|')}$`),
    failureMessage: (_filename: string) =>
      `Only these filetypes are supported in assets: ${SUPPORTED_ASSET_EXTS.join(', ')}`,
  },
  blocks: {
    validator: /.liquid$/,
    failureMessage: (_filename: string) => `Only .liquid files are allowed in blocks.`,
  },
  locales: {
    validator: new RegExp(`${SUPPORTED_LOCALE_EXTS.join('|')}$`),
    failureMessage: (_filename: string) =>
      `Only these filetypes are supported in locales: ${SUPPORTED_LOCALE_EXTS.join(', ')}`,
  },
  snippets: {
    validator: /.liquid$/,
    failureMessage: (_filename: string) => `Only .liquid files are allowed in snippets.`,
  },
}
const SUPPORTED_BUCKETS = Object.keys(SUPPORTED_EXTS)

async function validateThemeExtension(extension: ExtensionInstance): Promise<void> {
  const themeFiles = await themeExtensionFiles(extension)
  const liquidBytes: number[] = []
  const extensionBytes: number[] = []
  await Promise.all(
    themeFiles.map(async (filepath) => {
      const relativePathName = relativePath(extension.directory, filepath)
      const directoryName = dirname(relativePathName)
      validateFile(relativePathName, directoryName)
      const filesize = await fileSize(filepath)
      extensionBytes.push(filesize)
      if (['blocks', 'snippets'].includes(directoryName)) liquidBytes.push(filesize)
    }),
  )
  validateExtensionBytes(arraySum(extensionBytes))
  validateLiquidBytes(arraySum(liquidBytes))
}

function validateExtensionBytes(extensionBytesTotal: number): void {
  if (extensionBytesTotal > BUNDLE_SIZE_LIMIT) {
    const humanBundleSize = `${(extensionBytesTotal / megabytes).toFixed(2)} MB`
    throw new AbortError(
      `Your theme app extension exceeds the file size limit (${BUNDLE_SIZE_LIMIT_MB} MB). It's currently ${humanBundleSize}.`,
      `Reduce your total file size and try again.`,
    )
  }
}

function validateLiquidBytes(liquidBytesTotal: number): void {
  if (liquidBytesTotal > LIQUID_SIZE_LIMIT) {
    const humanLiquidSize = `${(liquidBytesTotal / kilobytes).toFixed(2)} kB`
    throw new AbortError(
      `Your theme app extension exceeds the total liquid file size limit (${LIQUID_SIZE_LIMIT_KB} kB). It's currently ${humanLiquidSize}.`,
      `Reduce your total file size and try again.`,
    )
  }
}

function validateFile(filepath: string, dirname: string): void {
  if (!SUPPORTED_BUCKETS.includes(dirname)) {
    throw new AbortError(
      outputContent`Your theme app extension includes files in an unsupported directory, ${outputToken.path(dirname)}`,
      `Make sure all theme app extension files are in the supported directories: ${SUPPORTED_BUCKETS.join(', ')}`,
    )
  }

  const filenameValidation = SUPPORTED_EXTS[dirname]!
  if (!filepath.match(filenameValidation.validator)) {
    throw new AbortError(`Invalid filename in your theme app extension: ${filepath}
${filenameValidation.failureMessage(filepath)}`)
  }
}

function arraySum(array: number[]): number {
  return array.reduce((num1, num2) => num1 + num2, 0)
}
