import {handleToOwnerType, type ThemeMetafieldsPullResult, type MetafieldDefinitions} from './metafields-pull/types.js'
import {renderThemeMetafieldsPullResult} from './metafields-pull/result.js'
import {configureCLIEnvironment} from '../utilities/cli-config.js'
import {ensureThemeStore} from '../utilities/theme-store.js'
import {ensureDirectoryConfirmed} from '../utilities/theme-ui.js'
import {hasRequiredThemeDirectories} from '../utilities/theme-fs.js'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {metafieldDefinitionsByOwnerType} from '@shopify/cli-kit/node/themes/api'
import {writeFileSync} from '@shopify/cli-kit/node/fs'
import {getOrCreateHiddenShopifyFolder} from '@shopify/cli-kit/node/hidden-folder'

interface MetafieldsPullOptions {
  path: string
  force: boolean
}

export interface MetafieldsPullFlags {
  /**
   * The directory path of the theme to download the metafield definitions.
   */
  path?: string

  /**
   * The password for authenticating with the store.
   */
  password?: string

  /**
   * Store URL. It can be the store prefix (example.myshopify.com) or the full myshopify.com URL (https://example.myshopify.com).
   */
  store?: string

  /**
   * Proceed without confirmation, if current directory does not seem to be theme directory.
   */
  force?: boolean

  /**
   * Disable color output.
   */
  noColor?: boolean

  /**
   * Increase the verbosity of the output.
   */
  verbose?: boolean

  /**
   * Suppress all output.
   */
  silent?: boolean
}

/**
 * Pulls the metafield definitions from an authenticated store.
 *
 * @param flags - All flags are optional.
 */
export async function metafieldsPull(flags: MetafieldsPullFlags): Promise<void> {
  // Compatibility adapter for theme dev and callers that request silent downloads.
  const result = await downloadMetafieldDefinitions(flags)
  renderThemeMetafieldsPullResult(result, 'text', flags.silent)
}

export async function downloadMetafieldDefinitions(flags: MetafieldsPullFlags): Promise<ThemeMetafieldsPullResult> {
  configureCLIEnvironment({verbose: flags.verbose, noColor: flags.noColor})

  const store = ensureThemeStore({store: flags.store})
  const adminSession = await ensureAuthenticatedThemes(store, flags.password)

  return executeMetafieldsPull(adminSession, {
    path: flags.path ?? cwd(),
    force: flags.force ?? false,
  })
}

/**
 * Executes the pullMetafields operation for the shop.
 *
 * @param session - the admin session to access the API and download the metafield definitions
 * @param options - the options that modify where the file gets created
 */
async function executeMetafieldsPull(
  session: AdminSession,
  options: MetafieldsPullOptions,
): Promise<ThemeMetafieldsPullResult> {
  const {force, path} = options

  if (!(await hasRequiredThemeDirectories(path))) {
    // If this is not a theme, and the CLI is run by the language server, quick return
    if (process.env.SHOPIFY_LANGUAGE_SERVER === '1') {
      return {status: 'skipped', reason: 'not-a-theme'}
    }

    // Ensure the user is okay with running this command outside a theme
    if (!(await ensureDirectoryConfirmed(force))) {
      return {status: 'skipped', reason: 'cancelled'}
    }
  }

  const promises = []
  const failedFetchByOwnerType: (typeof handleToOwnerType)[keyof typeof handleToOwnerType][] = []

  for (const [handle, ownerType] of Object.entries(handleToOwnerType)) {
    promises.push(
      metafieldDefinitionsByOwnerType(ownerType, session)
        .catch((_) => {
          failedFetchByOwnerType.push(ownerType)
          return []
        })
        .then((definitions) => {
          return {
            [handle]: definitions,
          }
        }),
    )
  }

  const result = (await Promise.all(promises)).reduce((acc, metafieldDefinitionByOwnerType) => ({
    ...acc,
    ...metafieldDefinitionByOwnerType,
  }))

  const failedOwnerTypes = Object.values(handleToOwnerType).filter((type) => failedFetchByOwnerType.includes(type))
  if (failedOwnerTypes.length === Object.values(handleToOwnerType).length) {
    return {status: 'failed', failedOwnerTypes}
  }

  const filePath = await writeMetafieldDefinitionsToFile(path, result)
  return {status: 'downloaded', path: filePath, definitions: result as MetafieldDefinitions, failedOwnerTypes}
}

async function writeMetafieldDefinitionsToFile(path: string, content: unknown) {
  const shopifyDirectory = await getOrCreateHiddenShopifyFolder(path)

  const filePath = joinPath(shopifyDirectory, 'metafields.json')
  const fileContent = JSON.stringify(content, null, 2)

  writeFileSync(filePath, fileContent)
  return filePath
}
