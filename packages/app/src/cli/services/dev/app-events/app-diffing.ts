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
  const oldExtensionsUids = oldExtensions.map((ext) => ext.uid)
  const newExtensions = newApp.realExtensions
  const newExtensionsUids = newExtensions.map((ext) => ext.uid)

  const createdExtensions = newExtensions.filter((ext) => !oldExtensionsUids.includes(ext.uid))
  const deletedExtensions = oldExtensions.filter((ext) => !newExtensionsUids.includes(ext.uid))

  let updatedExtensions
  if (includeUpdated) {
    updatedExtensions = newExtensions.filter((ext) => {
      const oldExtension = oldExtensions.find((oldExt) => oldExt.uid === ext.uid)
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
