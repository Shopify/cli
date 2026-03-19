/**
 * Manifest-based lazy command loader.
 *
 * Reads the oclif manifest to discover which package owns each command, then
 * derives the entry point from the command ID using a naming convention:
 *   dist/cli/commands/\{id with : replaced by /\}.js
 *
 * This lets us dynamically import ONLY the specific command file instead of
 * loading every command from the package index.
 *
 * Commands from external plugins (cli-hydrogen, oclif plugins) fall back to
 * importing the full package.
 */
import {dirname, joinPath, moduleDirectory} from '@shopify/cli-kit/node/path'
import {readFileSync} from 'fs'
import {createRequire} from 'module'
import {pathToFileURL} from 'url'

const require = createRequire(import.meta.url)

interface ManifestCommand {
  customPluginName?: string
  pluginName?: string
}

let cachedCommands: Record<string, ManifestCommand> | undefined

function getManifestCommands(): Record<string, ManifestCommand> {
  if (!cachedCommands) {
    const manifestPath = joinPath(moduleDirectory(import.meta.url), '..', 'oclif.manifest.json')
    cachedCommands = JSON.parse(readFileSync(manifestPath, 'utf8')).commands
  }
  return cachedCommands!
}

const packageDirCache = new Map<string, string>()

function resolvePackageDir(packageName: string): string {
  let dir = packageDirCache.get(packageName)
  if (!dir) {
    dir = dirname(require.resolve(`${packageName}/package.json`))
    packageDirCache.set(packageName, dir)
  }
  return dir
}

const entryPointOverrides: Record<string, string> = {
  'app:logs:sources': 'dist/cli/commands/app/app-logs/sources.js',
  'demo:watcher': 'dist/cli/commands/app/demo/watcher.js',
  'kitchen-sink': 'dist/cli/commands/kitchen-sink/index.js',
  'doctor-release': 'dist/cli/commands/doctor-release/doctor-release.js',
  'doctor-release:theme': 'dist/cli/commands/doctor-release/theme/index.js',
}

function entryPointForCommand(id: string): string {
  return entryPointOverrides[id] ?? `dist/cli/commands/${id.replace(/:/g, '/')}.js`
}

const packagesWithPerFileLoading = new Set(['@shopify/cli', '@shopify/app', '@shopify/theme'])

/**
 * Load a command class by its ID.
 *
 * Looks up the command in the oclif manifest to find the owning package,
 * derives the file path from the command ID, and imports only that file.
 * Falls back to importing the full package for external plugins.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadCommand(id: string): Promise<any | undefined> {
  const commands = getManifestCommands()
  const entry = commands[id]
  if (!entry) return undefined

  const packageName = entry.customPluginName ?? entry.pluginName
  if (!packageName) return undefined

  if (packagesWithPerFileLoading.has(packageName)) {
    const packageDir = resolvePackageDir(packageName)
    const entryPoint = entryPointForCommand(id)
    const modulePath = pathToFileURL(joinPath(packageDir, entryPoint)).href
    const module = await import(modulePath)
    return module.default
  }

  return loadCommandFromPackage(id, packageName)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadCommandFromPackage(id: string, packageName: string): Promise<any | undefined> {
  if (packageName === '@shopify/cli-hydrogen') {
    const {COMMANDS} = await import('@shopify/cli-hydrogen')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (COMMANDS as any)?.[id]
  }

  if (packageName === '@oclif/plugin-commands') {
    const {commands} = await import('@oclif/plugin-commands')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (commands as any)[id]
  }

  if (packageName === '@oclif/plugin-plugins') {
    const {commands} = await import('@oclif/plugin-plugins')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (commands as any)[id]
  }

  if (packageName === '@shopify/plugin-did-you-mean') {
    const {DidYouMeanCommands} = await import('@shopify/plugin-did-you-mean')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (DidYouMeanCommands as any)[id]
  }

  return undefined
}
