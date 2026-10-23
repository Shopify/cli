import {AppInterface} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'

interface AppExtensionsDiff {
  created: ExtensionInstance[]
  updated: ExtensionInstance[]
  deleted: ExtensionInstance[]
}

/**
 * Compares the extensions of two apps and return the differences.
 *
 * This function compares each extension config to detect if it was updated.
 * To avoid that complexity if you don't need it, use includeUpdated=false.
 *
 * @param app - The old app.
 * @param newApp - The new app.
 * @param includeUpdated - Whether to include updated extensions in the diff.
 * @returns The diff between the extensions of the two apps.
 */
export function appDiff(app: AppInterface, newApp: AppInterface, includeUpdated = true): AppExtensionsDiff {
  const oldExtensions = app.realExtensions
  const newExtensions = newApp.realExtensions

  // Indexing by uid keeps every lookup below O(1). The previous implementation scanned the opposite
  // array for each extension, which is O(n²) on a path that runs on every file change during `app dev`.
  const oldExtensionsByUid = new Map(oldExtensions.map((ext) => [ext.uid, ext]))
  const newExtensionsUids = new Set(newExtensions.map((ext) => ext.uid))

  const createdExtensions = newExtensions.filter((ext) => !oldExtensionsByUid.has(ext.uid))
  const deletedExtensions = oldExtensions.filter((ext) => !newExtensionsUids.has(ext.uid))

  let updatedExtensions
  if (includeUpdated) {
    updatedExtensions = newExtensions.filter((ext) => {
      const oldExtension = oldExtensionsByUid.get(ext.uid)
      if (!oldExtension) return false
      const configChanged = JSON.stringify(oldExtension.configuration) !== JSON.stringify(ext.configuration)
      const extensionPathChanged = oldExtension.configurationPath !== ext.configurationPath
      return configChanged || extensionPathChanged
    })
  }

  return {
    created: createdExtensions,
    updated: updatedExtensions ?? [],
    deleted: deletedExtensions,
  }
}
