import {AssetIdentifier, BuildAsset} from '../specification.js'
import {fileExists, copyFile} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname, basename} from '@shopify/cli-kit/node/path'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {err, ok, Result} from '@shopify/cli-kit/node/result'

// Re-export ok and err for use in specification overrides
export {ok, err}

/**
 * Minimal interface for targeting configurations with build manifests.
 * This allows both UI extensions (with modules) and static-only extensions (without modules)
 * to use the same build manifest utilities.
 */
export interface TargetingWithBuildManifest {
  target: string
  build_manifest?: BuildManifest
}

/**
 * Generic build manifest structure that can contain any combination of assets.
 * Different specifications can define their own subset of supported assets.
 */
export interface BuildManifest {
  assets: {
    [AssetIdentifier.Main]?: BuildAsset
    [AssetIdentifier.ShouldRender]?: BuildAsset
    [AssetIdentifier.Tools]?: BuildAsset
    [AssetIdentifier.Instructions]?: BuildAsset
    [AssetIdentifier.Intents]?: BuildAsset[]
    [key: string]: BuildAsset | BuildAsset[] | undefined
  }
}

/**
 * Configuration for static assets (tools, instructions, intents).
 */
export interface StaticAssetsConfig {
  target: string
  tools?: string
  instructions?: string
  intents?: {
    type: string
    action: string
    schema: string
    name?: string
    description?: string
  }[]
}

/**
 * Transform static asset configuration into build manifest format (tools, instructions, intents).
 * Returns a partial object with build_manifest and top-level fields that can be merged
 * into the extension point configuration.
 *
 * @param config - Static assets configuration from targeting
 * @param handle - Extension handle for generating filenames
 * @returns Partial extension point config with build_manifest and static asset fields
 */
export function transformStaticAssets(config: StaticAssetsConfig, handle: string) {
  const assets: Partial<BuildManifest['assets']> = {}

  if (config.tools) {
    assets[AssetIdentifier.Tools] = {
      filepath: `${handle}-${config.target}-${AssetIdentifier.Tools}-${basename(config.tools)}`,
      module: config.tools,
      static: true,
    }
  }

  if (config.instructions) {
    assets[AssetIdentifier.Instructions] = {
      filepath: `${handle}-${config.target}-${AssetIdentifier.Instructions}-${basename(config.instructions)}`,
      module: config.instructions,
      static: true,
    }
  }

  if (config.intents) {
    assets[AssetIdentifier.Intents] = config.intents.map((intent, index) => ({
      filepath: `${handle}-${config.target}-${AssetIdentifier.Intents}-${index + 1}-${basename(intent.schema)}`,
      module: intent.schema,
      static: true,
    }))
  }

  return {
    build_manifest: {
      assets,
    },
    tools: config.tools,
    instructions: config.instructions,
    ...(config.intents ? {intents: config.intents} : {}),
  }
}

/**
 * Copy static assets from the extension directory to the output path.
 * Processes all assets in the build manifest that are marked as static.
 *
 * @param targeting - Array of targeting configurations with build manifests
 * @param directory - Source directory containing the assets
 * @param outputPath - Destination path for the copied assets
 */
export async function copyStaticBuildManifestAssets(
  targeting: TargetingWithBuildManifest[],
  directory: string,
  outputPath: string,
): Promise<void> {
  await Promise.all(
    targeting.flatMap((target) => {
      if (!('build_manifest' in target) || !target.build_manifest) return []

      return Object.entries(target.build_manifest.assets)
        .filter((entry): entry is [string, BuildAsset | BuildAsset[]] => {
          const [_, asset] = entry
          return asset !== undefined && isStaticAsset(asset)
        })
        .map(([_, asset]) => {
          if (Array.isArray(asset)) {
            return Promise.all(asset.map((childAsset) => copyAsset(childAsset, directory, outputPath)))
          }

          return copyAsset(asset, directory, outputPath)
        })
    }),
  )
}

/**
 * Copy a single asset file if it's marked as static.
 *
 * @param asset - The asset to copy
 * @param directory - Source directory
 * @param outputPath - Destination path
 */
async function copyAsset(
  {module, filepath, static: isStatic}: BuildAsset,
  directory: string,
  outputPath: string,
): Promise<void> {
  if (isStatic) {
    const sourceFile = joinPath(directory, module)
    const outputFilePath = joinPath(dirname(outputPath), filepath)
    await copyFile(sourceFile, outputFilePath).catch((error) => {
      throw new Error(`Failed to copy static asset ${module} to ${outputFilePath}: ${error.message}`)
    })
  }
}

/**
 * Check if a file path exists and return an error message if it doesn't.
 *
 * @param directory - Base directory
 * @param assetModule - Relative path to the asset
 * @param target - Extension point target (for error messages)
 * @param assetType - Type of asset (for error messages)
 * @returns Error message if file doesn't exist, undefined otherwise
 */
async function checkForMissingPath(
  directory: string,
  assetModule: string | undefined,
  target: string,
  assetType: string,
): Promise<string | undefined> {
  if (!assetModule) return undefined

  const assetPath = joinPath(directory, assetModule)
  const exists = await fileExists(assetPath)
  return exists
    ? undefined
    : outputContent`Couldn't find ${outputToken.path(assetPath)}
  Please check the ${assetType} path for ${target}`.value
}

/**
 * Validate that all asset files referenced in the build manifest exist.
 * Validates all assets present in the build manifest.
 *
 * @param directory - Extension directory
 * @param targeting - Array of targeting configurations to validate
 * @returns Result indicating success or failure with error messages
 */
export async function validateBuildManifestAssets(
  directory: string,
  targeting: TargetingWithBuildManifest[],
): Promise<Result<unknown, string>> {
  const validationPromises = targeting.flatMap((targetConfig) => {
    const {target, build_manifest: buildManifest} = targetConfig

    if (!buildManifest) return []

    // Validate each asset type
    return Object.entries(buildManifest.assets).flatMap(([identifier, asset]) => {
      if (!asset) return []

      const mappedAssets = Array.isArray(asset) ? asset : [asset]
      return mappedAssets.map((assetItem) =>
        checkForMissingPath(directory, assetItem.module, target, getAssetDisplayName(identifier as AssetIdentifier)),
      )
    })
  })

  const validationResults = await Promise.all(validationPromises)
  const errors = validationResults.filter((error): error is string => error !== undefined)

  if (errors.length) {
    return err(errors.join('\n\n'))
  }
  return ok({})
}

/**
 * Transform extension points by adding dist path to all assets.
 * This is used during deployment to update asset paths.
 *
 * @param extensionPoint - Extension point with build manifest
 * @returns Extension point with updated asset paths
 */
export function addDistPathToAssets<T extends TargetingWithBuildManifest & {build_manifest: BuildManifest}>(
  extP: T,
): T {
  return {
    ...extP,
    build_manifest: {
      ...extP.build_manifest,
      assets: Object.fromEntries(
        Object.entries(extP.build_manifest.assets)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => {
            if (!value) return [key, value]

            return [
              key as AssetIdentifier,
              Array.isArray(value)
                ? value.map((asset) => ({
                    ...asset,
                    filepath: joinPath('dist', asset.filepath),
                  }))
                : {
                    ...value,
                    filepath: joinPath('dist', value.filepath),
                  },
            ]
          }),
      ),
    },
  }
}

/**
 * Check if an asset is static and should be copied.
 *
 * @param asset - Asset or array of assets to check
 * @returns True if the asset(s) are static
 */
function isStaticAsset(asset: BuildAsset | BuildAsset[]): boolean {
  if (Array.isArray(asset)) {
    return asset.every((assetItem) => assetItem.static)
  }
  return asset.static === true
}

/**
 * Get a human-readable display name for an asset identifier.
 *
 * @param identifier - Asset identifier
 * @returns Display name
 */
function getAssetDisplayName(identifier: AssetIdentifier): string {
  switch (identifier) {
    case AssetIdentifier.Main:
      return 'main module'
    case AssetIdentifier.ShouldRender:
      return 'should render module'
    case AssetIdentifier.Tools:
      return 'tools'
    case AssetIdentifier.Instructions:
      return 'instructions'
    case AssetIdentifier.Intents:
      return 'intent schema'
    default:
      return identifier
  }
}
