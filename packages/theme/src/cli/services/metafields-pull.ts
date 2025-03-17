import {hasRequiredThemeDirectories} from '../utilities/theme-fs.js'
import {ensureDirectoryConfirmed} from '../utilities/theme-ui.js'
import {ensureThemeStore} from '../utilities/theme-store.js'
import {configureCLIEnvironment} from '../utilities/cli-config.js'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {metafieldDefinitionsByOwnerType} from '@shopify/cli-kit/node/themes/api'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import {fileExistsSync, mkdirSync, writeFileSync} from '@shopify/cli-kit/node/fs'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {addToGitIgnore} from '@shopify/cli-kit/node/git'

interface MetafieldsPullOptions {
  path: string
  force: boolean
  silent: boolean
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
  configureCLIEnvironment({verbose: flags.verbose, noColor: flags.noColor})

  const store = ensureThemeStore({store: flags.store})
  const adminSession = await ensureAuthenticatedThemes(store, flags.password)

  await executeMetafieldsPull(adminSession, {
    path: flags.path ?? cwd(),
    force: flags.force ?? false,
    silent: flags.silent ?? false,
  })
}

const handleToOwnerType = {
  article: 'ARTICLE',
  blog: 'BLOG',
  collection: 'COLLECTION',
  company: 'COMPANY',
  company_location: 'COMPANY_LOCATION',
  location: 'LOCATION',
  market: 'MARKET',
  order: 'ORDER',
  page: 'PAGE',
  product: 'PRODUCT',
  variant: 'PRODUCTVARIANT',
  shop: 'SHOP',
} as const

/**
 * Executes the pullMetafields operation for the shop.
 *
 * @param session - the admin session to access the API and download the metafield definitions
 * @param options - the options that modify where the file gets created
 */
async function executeMetafieldsPull(session: AdminSession, options: MetafieldsPullOptions) {
  const {force, path, silent} = options

  if (!(await hasRequiredThemeDirectories(path))) {
    // If this is not a theme, and the CLI is run by the language server, quick return
    if (process.env.SHOPIFY_LANGUAGE_SERVER === '1') {
      return
    }

    // Ensure the user is okay with running this command outside a theme
    if (!(await ensureDirectoryConfirmed(force))) {
      return
    }
  }

  const promises = []
  const failedFetchByOwnerType: string[] = []

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

  if (failedFetchByOwnerType.length === Object.values(handleToOwnerType).length) {
    if (!silent) {
      renderError({
        body: `Failed to fetch metafield definitions.`,
        nextSteps: [
          'Check your network connection and try again.',
          'Ensure you have the permission to fetch metafield definitions.',
        ],
        reference: [
          {
            link: {
              label: 'Metafield Definition API',
              url: 'https://shopify.dev/docs/api/admin-graphql/latest/queries/metafieldDefinition',
            },
          },
        ],
      })
    }
    return
  }

  writeMetafieldDefinitionsToFile(path, result)

  if (failedFetchByOwnerType.length > 0) {
    outputDebug(
      `Failed to fetch metafield definitions for the following owner types: ${failedFetchByOwnerType.join(', ')}`,
    )
  }

  if (!silent) {
    renderSuccess({body: 'Metafield definitions have been successfully downloaded.'})
  }
}

function writeMetafieldDefinitionsToFile(path: string, content: unknown) {
  const shopifyDirectory = joinPath(path, '.shopify')
  mkdirSync(shopifyDirectory)

  const filePath = joinPath(shopifyDirectory, 'metafields.json')
  const fileContent = JSON.stringify(content, null, 2)

  if (!fileExistsSync(filePath)) {
    addToGitIgnore(path, '.shopify')
  }

  writeFileSync(filePath, fileContent)
}
