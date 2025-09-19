import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {AppInterface} from '../../../models/app/app.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {extractImportPaths} from '@shopify/cli-kit/node/import-extractor'
import {normalizePath, resolvePath, isSubpath} from '@shopify/cli-kit/node/path'

/**
 * Manages import scanning and tracking for extensions
 */
export class ImportManager {
  /**
   * Map to track which files are imported by which extensions
   * Key: normalized absolute path of imported file
   * Value: Set of extension directories that import this file
   */
  private readonly importedFileToExtensions = new Map<string, Set<string>>()

  /**
   * Promise that tracks ongoing rescan operations to prevent concurrent rescans
   */
  private rescanPromise: Promise<void> | null = null

  /**
   * Scans extensions for imports and tracks which files are imported by which extensions
   */
  async scanExtensionsForImports(
    app: AppInterface,
    extensions: ExtensionInstance[] = app.nonConfigExtensions,
  ): Promise<string[]> {
    this.clearImportMappingsForExtensions(app.realExtensions, extensions)

    // Extract imports from all extensions in parallel
    const extensionResults = await Promise.all(
      extensions.map(async (extension) => {
        try {
          const entryFiles = extension.getExtensionEntryFiles()
          const imports: string[] = []

          entryFiles.forEach((entryFile) => {
            imports.push(...extractImportPaths(entryFile))
          })

          outputDebug(`Found ${imports.length} imports for extension ${extension.handle}`)
          return {extension, imports}
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (error) {
          outputDebug(`Failed to extract imports for extension at ${extension.directory}: ${error}`)
          return {extension, imports: []}
        }
      }),
    )

    this.updateImportMappings(extensionResults)

    // Get all imported paths that need to be watched
    return this.getAllImportedPaths()
  }

  /**
   * Gets all imported file paths that need to be watched
   */
  getAllImportedPaths(): string[] {
    const paths: string[] = []
    for (const [normalizedPath] of this.importedFileToExtensions) {
      paths.push(resolvePath(normalizedPath))
    }
    return paths
  }

  /**
   * Gets extensions that import a specific file
   */
  getExtensionsImportingFile(filePath: string): Set<string> | undefined {
    const normalizedPath = normalizePath(resolvePath(filePath))
    return this.importedFileToExtensions.get(normalizedPath)
  }

  /**
   * Rescans imports for specific extensions
   * This method never throws - all errors are handled internally
   */
  async rescanExtensionImports(app: AppInterface, extensionPaths: string[]): Promise<void> {
    // If there's already a rescan in progress, wait for it to complete first
    if (this.rescanPromise) {
      outputDebug(`Waiting for existing rescan to complete before rescanning ${extensionPaths.length} extensions`)
      await this.rescanPromise
    }

    // Create a new promise for this rescan operation
    this.rescanPromise = (async () => {
      try {
        // Find all extensions that need rescanning
        const extensions: ExtensionInstance[] = []
        const normalizedPaths = new Set(extensionPaths.map((path) => normalizePath(path)))

        for (const extension of app.realExtensions) {
          if (normalizedPaths.has(normalizePath(extension.directory))) {
            extensions.push(extension)
          }
        }

        if (extensions.length === 0) {
          outputDebug(`No extensions found for paths: ${extensionPaths.join(', ')}`)
          return
        }

        outputDebug(
          `Rescanning imports for ${extensions.length} extensions: ${extensions.map((ext) => ext.handle).join(', ')}`,
        )

        // Call scanExtensionsForImports with all affected extensions to refresh their mappings
        await this.scanExtensionsForImports(app, extensions)
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error) {
        outputDebug(`Failed to rescan imports for extensions: ${error}`)
      }
    })()

    try {
      await this.rescanPromise
    } finally {
      // Clear the promise when done
      this.rescanPromise = null
    }
  }

  /**
   * Clears import mappings for specific extensions
   */
  private clearImportMappingsForExtensions(
    allExtensions: ExtensionInstance[],
    extensionsToClear: ExtensionInstance[],
  ): void {
    if (extensionsToClear === allExtensions) {
      this.importedFileToExtensions.clear()
      return
    }

    const extensionDirs = new Set(extensionsToClear.map((ext) => normalizePath(ext.directory)))

    for (const [importPath, importingExtensions] of this.importedFileToExtensions.entries()) {
      for (const extDir of extensionDirs) {
        importingExtensions.delete(extDir)
      }
      if (importingExtensions.size === 0) {
        this.importedFileToExtensions.delete(importPath)
      }
    }
  }

  /**
   * Updates the import mappings with new scan results
   */
  private updateImportMappings(results: {extension: ExtensionInstance; imports: string[]}[]): void {
    for (const {extension, imports} of results) {
      const extensionDir = normalizePath(extension.directory)

      for (const importPath of imports) {
        const normalizedImportPath = normalizePath(resolvePath(importPath))

        // Skip files within the extension directory
        if (isSubpath(extensionDir, normalizedImportPath)) continue

        // Add mapping
        if (!this.importedFileToExtensions.has(normalizedImportPath)) {
          this.importedFileToExtensions.set(normalizedImportPath, new Set())
        }
        const extensionSet = this.importedFileToExtensions.get(normalizedImportPath)
        if (extensionSet) {
          extensionSet.add(extensionDir)
        }
      }
    }
  }
}
