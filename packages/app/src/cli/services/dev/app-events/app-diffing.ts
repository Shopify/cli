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
  const oldExtensionsHandles = oldExtensions.map((ext) => ext.handle)
  const newExtensions = newApp.realExtensions
  const newExtensionsHandles = newExtensions.map((ext) => ext.handle)

  const createdExtensions = newExtensions.filter((ext) => !oldExtensionsHandles.includes(ext.handle))
  const deletedExtensions = oldExtensions.filter((ext) => !newExtensionsHandles.includes(ext.handle))

  let updatedExtensions
  if (includeUpdated) {
    updatedExtensions = newExtensions.filter((ext) => {
      const oldConfig = oldExtensions.find((oldExt) => oldExt.handle === ext.handle)?.configuration
      const newConfig = ext.configuration
      if (oldConfig === undefined) return false
      return JSON.stringify(oldConfig) !== JSON.stringify(newConfig)
    })
  }

  return {
    created: createdExtensions,
    updated: updatedExtensions ?? [],
    deleted: deletedExtensions,
  }
}
