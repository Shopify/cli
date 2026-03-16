import {configurationFileNames} from '../../constants.js'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
import {readAndParseDotEnv, DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {fileExists, glob, findPathUp, readFile} from '@shopify/cli-kit/node/fs'
import {
  getDependencies,
  getPackageManager,
  PackageManager,
  usesWorkspaces as detectUsesWorkspaces,
} from '@shopify/cli-kit/node/node-package-manager'
import {joinPath, basename} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

const APP_CONFIG_GLOB = 'shopify.app*.toml'
const APP_CONFIG_REGEX = /^shopify\.app(\.[-\w]+)?\.toml$/
const EXTENSION_TOML = '*.extension.toml'
const WEB_TOML = 'shopify.web.toml'
const DEFAULT_EXTENSION_DIR = 'extensions/*'
const NODE_MODULES_EXCLUDE = '**/node_modules/**'
const DOTENV_GLOB = '.env*'

/**
 * A Project is the Shopify app as it exists on the filesystem.
 *
 * It abstracts the OS and location concerns — knows what files exist,
 * where they are, and how to read/write them. It does NOT interpret
 * config files as modules, select which config is active, or know
 * about the platform.
 *
 * @public
 */
export class Project {
  /**
   * Discover a project from the filesystem.
   *
   * Walks up from the given directory to find the app root (the directory
   * containing shopify.app*.toml files). Discovers all config files,
   * metadata, and dependencies.
   *
   * Does NOT select which config is active or resolve modules.
   */
  static async load(startDirectory: string): Promise<Project> {
    const directory = await findProjectRoot(startDirectory)

    // Discover all app config files
    const appConfigFiles = await discoverAppConfigFiles(directory)
    if (appConfigFiles.length === 0) {
      throw new AbortError(`Could not find a Shopify app TOML file in ${directory}`)
    }

    // Discover extension files from all app configs' extension_directories (union).
    // Configs that don't specify extension_directories use the default (extensions/*).
    const allExtensionDirs = new Set<string>()
    for (const appConfig of appConfigFiles) {
      const dirs = appConfig.content.extension_directories
      if (Array.isArray(dirs)) {
        for (const dir of dirs) allExtensionDirs.add(dir as string)
      } else {
        allExtensionDirs.add(DEFAULT_EXTENSION_DIR)
      }
    }
    const extensionConfigFiles = await discoverExtensionFiles(directory, [...allExtensionDirs])

    // Discover web files from all app configs' web_directories (union)
    const allWebDirs = new Set<string>()
    for (const appConfig of appConfigFiles) {
      const dirs = appConfig.content.web_directories
      if (Array.isArray(dirs)) {
        for (const dir of dirs) allWebDirs.add(dir as string)
      }
    }
    const webConfigFiles = await discoverWebFiles(directory, allWebDirs.size > 0 ? [...allWebDirs] : undefined)

    // Project metadata
    const packageJSONPath = joinPath(directory, 'package.json')
    const hasPackageJson = await fileExists(packageJSONPath)
    const packageManager = hasPackageJson ? await getPackageManager(directory) : 'unknown'
    const nodeDependencies = hasPackageJson ? await getDependencies(packageJSONPath) : {}
    const usesWorkspaces = hasPackageJson ? await detectUsesWorkspaces(directory) : false

    // Dotenv: discover ALL .env* files in the root
    const dotenvFiles = await discoverDotEnvFiles(directory)

    // Hidden config: store the raw .shopify/project.json content
    const hiddenConfigRaw = await loadRawHiddenConfig(directory)

    return new Project({
      directory,
      packageManager,
      nodeDependencies,
      usesWorkspaces,
      appConfigFiles,
      extensionConfigFiles,
      webConfigFiles,
      dotenvFiles,
      hiddenConfigRaw,
    })
  }

  readonly directory: string
  readonly packageManager: PackageManager
  readonly nodeDependencies: Record<string, string>
  readonly usesWorkspaces: boolean
  readonly appConfigFiles: TomlFile[]
  readonly extensionConfigFiles: TomlFile[]
  readonly webConfigFiles: TomlFile[]

  /** All .env* files discovered in the project root, keyed by filename */
  readonly dotenvFiles: Map<string, DotEnvFile>

  /** Raw .shopify/project.json content — selection logic looks up by client_id */
  readonly hiddenConfigRaw: JsonMapType

  private constructor(options: {
    directory: string
    packageManager: PackageManager
    nodeDependencies: Record<string, string>
    usesWorkspaces: boolean
    appConfigFiles: TomlFile[]
    extensionConfigFiles: TomlFile[]
    webConfigFiles: TomlFile[]
    dotenvFiles: Map<string, DotEnvFile>
    hiddenConfigRaw: JsonMapType
  }) {
    this.directory = options.directory
    this.packageManager = options.packageManager
    this.nodeDependencies = options.nodeDependencies
    this.usesWorkspaces = options.usesWorkspaces
    this.appConfigFiles = options.appConfigFiles
    this.extensionConfigFiles = options.extensionConfigFiles
    this.webConfigFiles = options.webConfigFiles
    this.dotenvFiles = options.dotenvFiles
    this.hiddenConfigRaw = options.hiddenConfigRaw
  }

  // ── File lookup ───────────────────────────────────────────

  /** Find an app config file by filename (e.g., 'shopify.app.staging.toml') */
  appConfigByName(fileName: string): TomlFile | undefined {
    return this.appConfigFiles.find((file) => basename(file.path) === fileName)
  }

  /** Find an app config file by client_id */
  appConfigByClientId(clientId: string): TomlFile | undefined {
    return this.appConfigFiles.find((file) => file.content.client_id === clientId)
  }

  /** The default app config (shopify.app.toml), if it exists */
  get defaultAppConfig(): TomlFile | undefined {
    return this.appConfigByName(configurationFileNames.app)
  }
}

// ── Filesystem discovery functions ──────────────────────────

async function findProjectRoot(startDirectory: string): Promise<string> {
  const found = await findPathUp(
    async (directory) => {
      const matches = await glob(joinPath(directory, APP_CONFIG_GLOB))
      if (matches.length > 0) return directory
    },
    {
      cwd: startDirectory,
      type: 'directory',
    },
  )
  if (!found) {
    throw new AbortError(
      `Could not find a Shopify app configuration file. Looked in ${startDirectory} and parent directories.`,
    )
  }
  return found
}

async function discoverAppConfigFiles(directory: string): Promise<TomlFile[]> {
  const pattern = joinPath(directory, APP_CONFIG_GLOB)
  const paths = await glob(pattern)
  const validPaths = paths.filter((filePath) => APP_CONFIG_REGEX.test(basename(filePath)))
  return Promise.all(validPaths.map((filePath) => TomlFile.read(filePath)))
}

async function discoverExtensionFiles(directory: string, extensionDirectories?: string[]): Promise<TomlFile[]> {
  const dirs = extensionDirectories ?? [DEFAULT_EXTENSION_DIR]
  const patterns = dirs.map((dir) => joinPath(directory, dir, EXTENSION_TOML))
  patterns.push(`!${joinPath(directory, NODE_MODULES_EXCLUDE)}`)
  const paths = await glob(patterns)
  return Promise.all(paths.map((filePath) => TomlFile.read(filePath)))
}

async function discoverWebFiles(directory: string, webDirectories?: string[]): Promise<TomlFile[]> {
  const dirs = webDirectories ?? ['**']
  const patterns = dirs.map((dir) => joinPath(directory, dir, WEB_TOML))
  patterns.push(`!${joinPath(directory, NODE_MODULES_EXCLUDE)}`)
  const paths = await glob(patterns)
  return Promise.all(paths.map((filePath) => TomlFile.read(filePath)))
}

/** Discover all .env* files in the project root */
async function discoverDotEnvFiles(directory: string): Promise<Map<string, DotEnvFile>> {
  const pattern = joinPath(directory, DOTENV_GLOB)
  const paths = await glob(pattern, {dot: true})
  const validPaths = paths.filter((filePath) => {
    const fileName = basename(filePath)
    return fileName === '.env' || /^\.env\.\w+$/.test(fileName)
  })

  const entries = await Promise.all(
    validPaths.map(async (filePath) => {
      try {
        const dotenv = await readAndParseDotEnv(filePath)
        return [basename(filePath), dotenv] as const
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        return undefined
      }
    }),
  )

  const result = new Map<string, DotEnvFile>()
  for (const entry of entries) {
    if (entry) result.set(entry[0], entry[1])
  }
  return result
}

/** Load the raw .shopify/project.json as JsonMapType */
async function loadRawHiddenConfig(directory: string): Promise<JsonMapType> {
  const hiddenPath = joinPath(directory, configurationFileNames.hiddenFolder, configurationFileNames.hiddenConfig)
  try {
    if (await fileExists(hiddenPath)) {
      const raw = await readFile(hiddenPath)
      return JSON.parse(raw) as JsonMapType
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Parse errors are not fatal
  }
  return {}
}
