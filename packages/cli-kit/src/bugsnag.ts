import * as path from './path.js'
import {Interfaces} from '@oclif/core'
import Bugsnag from '@bugsnag/js'
import {realpath} from 'fs/promises'

/**
 * If the given file path comes from within a plugin, return the relative path, plus the plugin name.
 *
 * This gives us very consistent paths for errors thrown from plugin code.
 *
 */
export function cleanStackFrameFilePath(
  currentFilePath: string,
  projectRoot: string,
  pluginLocations: {name: string; pluginPath: string}[],
): string {
  const fullLocation = path.isAbsolute(currentFilePath) ? currentFilePath : path.join(projectRoot, currentFilePath)

  const matchingPluginPath = pluginLocations.filter(({pluginPath}) => fullLocation.indexOf(pluginPath) === 0)[0]

  if (matchingPluginPath !== undefined) {
    return path.join(matchingPluginPath.name, path.relative(matchingPluginPath.pluginPath, fullLocation))
  }
  return currentFilePath
}

/**
 * Register a Bugsnag error listener to clean up stack traces for errors within plugin code.
 *
 */
export async function registerCleanBugsnagErrorsFromWithinPlugins(plugins: Interfaces.Plugin[]) {
  // Bugsnag have their own plug-ins that use this private field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bugsnagConfigProjectRoot: string | undefined = (Bugsnag as any)?._client?._config?.projectRoot
  if (bugsnagConfigProjectRoot === undefined) {
    return
  }
  const projectRoot = path.normalize(bugsnagConfigProjectRoot)
  const pluginLocations = await Promise.all(
    plugins.map(async (plugin) => {
      const followSymlinks = await realpath(plugin.root)
      return {name: plugin.name, pluginPath: path.normalize(followSymlinks)}
    }),
  )
  Bugsnag.addOnError((event) => {
    event.errors.forEach((error) => {
      error.stacktrace.forEach((stackFrame) => {
        stackFrame.file = cleanStackFrameFilePath(stackFrame.file, projectRoot, pluginLocations)
      })
    })
  })
}
