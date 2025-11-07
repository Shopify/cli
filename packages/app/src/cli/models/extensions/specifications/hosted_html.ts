import {createExtensionSpecification, ExtensionFeature} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {ExtensionInstance} from '../extension-instance.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {glob, fileSize, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath, extname} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {zod} from '@shopify/cli-kit/node/schema'

const kilobytes = 1024
const megabytes = kilobytes * 1024

const BUNDLE_SIZE_LIMIT_MB = 50
const BUNDLE_SIZE_LIMIT = BUNDLE_SIZE_LIMIT_MB * megabytes

// Supported file types for hosted HTML apps
const SUPPORTED_FILE_EXTS = [
  '.html',
  '.css',
  '.js',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.gif',
  '.webp',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.ico',
]

export const HostedHtmlSchema = BaseSchema.extend({
  name: zod.string(),
  type: zod.literal('hosted_html'),
  entrypoint: zod.string().default('index.html'),
  // Optional: specify which app home extension points this can target
  targeting: zod
    .array(
      zod.object({
        target: zod.string(),
      }),
    )
    .optional(),
})

export type HostedHtmlSchemaType = zod.infer<typeof HostedHtmlSchema>

const hostedHtmlSpec = createExtensionSpecification({
  identifier: 'hosted_html',
  schema: HostedHtmlSchema,
  partnersWebIdentifier: 'hosted_html',
  graphQLType: 'hosted_html',
  buildConfig: {
    mode: 'copy_files',
    filePatterns: ['**/*.{html,css,js,json,png,jpg,jpeg,svg,gif,webp,woff,woff2,ttf,eot,ico}'],
    ignoredFilePatterns: ['node_modules/**', '.git/**', '**/*.test.*', '**/*.spec.*', '**/test/**', '**/tests/**'],
  },
  appModuleFeatures: (_config): ExtensionFeature[] => {
    return ['single_js_entry_path', 'bundling', 'app_home_extension']
  },
  preDeployValidation: async (extension) => {
    await validateHostedHtmlExtension(extension)
  },
  deployConfig: async (config, directory) => {
    return {
      api_version: config.api_version,
      name: config.name,
      description: config.description,
      entrypoint: config.entrypoint || 'index.html',
      localization: await loadLocalesConfig(directory, config.type),
      extension_points: config.targeting?.map((target) => ({
        target: target.target,
        entrypoint: config.entrypoint || 'index.html',
      })),
    }
  },
  deployableViaService: true,
})

async function validateHostedHtmlExtension(extension: ExtensionInstance): Promise<void> {
  const config = extension.configuration as HostedHtmlSchemaType
  const entrypoint = config.entrypoint || 'index.html'
  const entrypointPath = joinPath(extension.directory, entrypoint)

  // Check if entrypoint exists
  const allFiles = await glob(joinPath(extension.directory, '**/*'), {
    cwd: extension.directory,
    ignore: ['node_modules/**', '.git/**', '**/test/**', '**/tests/**'],
  })

  const entrypointExists = allFiles.some((file) => file === entrypointPath)
  if (!entrypointExists) {
    throw new AbortError(
      outputContent`Entrypoint file not found: ${outputToken.path(entrypoint)}`,
      'Make sure your entrypoint file exists in your extension directory.',
    )
  }

  // Validate all files
  const extensionBytes: number[] = []
  let hasHtmlFile = false

  const validationPromises = allFiles.map(async (filepath) => {
    const relativePathName = relativePath(extension.directory, filepath)
    const ext = extname(filepath)

    // Check file extension
    if (!SUPPORTED_FILE_EXTS.includes(ext)) {
      throw new AbortError(
        outputContent`Unsupported file type: ${outputToken.path(relativePathName)}`,
        `Only these file types are supported: ${SUPPORTED_FILE_EXTS.join(', ')}`,
      )
    }

    if (ext === '.html') {
      hasHtmlFile = true
      // Basic security validation for HTML files
      await validateHtmlFile(filepath, relativePathName)
    }

    const filesize = await fileSize(filepath)
    return filesize
  })

  extensionBytes.push(...(await Promise.all(validationPromises)))

  if (!hasHtmlFile) {
    throw new AbortError(
      'Your hosted HTML extension must contain at least one .html file',
      'Add an HTML file to your extension directory.',
    )
  }

  // Validate total size
  const totalBytes = extensionBytes.reduce((sum, size) => sum + size, 0)
  if (totalBytes > BUNDLE_SIZE_LIMIT) {
    const humanBundleSize = `${(totalBytes / megabytes).toFixed(2)} MB`
    throw new AbortError(
      `Your hosted HTML extension exceeds the file size limit (${BUNDLE_SIZE_LIMIT_MB} MB). It's currently ${humanBundleSize}.`,
      `Reduce your total file size and try again.`,
    )
  }
}

async function validateHtmlFile(filepath: string, relativePathName: string): Promise<void> {
  const content = await readFile(filepath)

  // Basic security checks - prevent common XSS vectors
  // External scripts (non-HTTPS)
  // Non-HTTPS iframes
  const dangerousPatterns = [
    /<script[^>]*src\s*=\s*["'](?!https:\/\/|\/\/)[^"']*["']/gi,
    /<iframe[^>]*src\s*=\s*["'](?!https:\/\/|\/\/)[^"']*["']/gi,
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      throw new AbortError(
        outputContent`Security concern in ${outputToken.path(relativePathName)}`,
        'External resources must use HTTPS. All scripts and iframes must use secure protocols.',
      )
    }
  }
}

export default hostedHtmlSpec
