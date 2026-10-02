import {themePushResultSchema} from './push/types.js'
import {checkThemeBeforePush, renderThemePushResult} from './push/result.js'
import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {uploadTheme} from '../utilities/theme-uploader.js'
import {ensureDirectoryConfirmed} from '../utilities/theme-ui.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {Role} from '../utilities/theme-selector/fetch.js'
import {configureCLIEnvironment} from '../utilities/cli-config.js'
import {ensureThemeStore} from '../utilities/theme-store.js'
import {ensureListingExists} from '../utilities/theme-listing.js'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {themeCreate, fetchChecksums, themePublish} from '@shopify/cli-kit/node/themes/api'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderConfirmationPrompt, RenderConfirmationPromptOptions, renderError} from '@shopify/cli-kit/node/ui'
import {themeEditorUrl, themePreviewUrl} from '@shopify/cli-kit/node/themes/urls'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {
  DEVELOPMENT_THEME_ROLE,
  LIVE_THEME_ROLE,
  promptThemeName,
  UNPUBLISHED_THEME_ROLE,
} from '@shopify/cli-kit/node/themes/utils'
import {recordTiming} from '@shopify/cli-kit/node/analytics'

import {commandEventOutputMode, emitCommandEvent} from '@shopify/cli-kit/node/command-events'
import {Writable} from 'stream'

interface PushOptions {
  path: string
  nodelete?: boolean
  force?: boolean
  publish?: boolean
  ignore?: string[]
  only?: string[]
  allowLive?: boolean
  environment?: string
  multiEnvironment?: boolean
  listing?: string
}

export interface PushFlags {
  /** The path to your theme directory. */
  path?: string

  /** Password generated from the Theme Access app. */
  password?: string

  /** Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com, https://example.myshopify.com). */
  store?: string

  /** Theme ID or name of the remote theme. */
  theme?: string

  /** Push theme files from your remote development theme. */
  development?: boolean

  /**
   * Unique identifier for a development theme context (e.g., PR number, branch name).
   * Reuses an existing development theme with this context name, or creates one if none exists.
   */
  developmentContext?: string

  /** Push theme files from your remote live theme. */
  live?: boolean

  /** Create a new unpublished theme and push to it. */
  unpublished?: boolean

  /** Runs the push command without deleting local files. */
  nodelete?: boolean

  /** Push only the specified files (Multiple flags allowed). */
  only?: string[]

  /** Skip downloading the specified files (Multiple flags allowed). */
  ignore?: string[]

  /** Output JSON instead of a UI. */
  json?: boolean

  /** Allow push to a live theme. */
  allowLive?: boolean

  /** Publish as the live theme after uploading. */
  publish?: boolean

  /** Proceed without confirmation, if current directory does not seem to be theme directory. */
  force?: boolean

  /** Disable color output. */
  noColor?: boolean

  /** Increase the verbosity of the output. */
  verbose?: boolean

  /** Require theme check to pass without errors before pushing. Warnings are allowed. */
  strict?: boolean

  /** The environment to push the theme to. */
  environment?: string[]

  /** The listing preset to use for multi-preset themes. */
  listing?: string
}

/**
 * Initiates the push process based on provided flags.
 *
 * @param flags - The flags for the push operation.
 */
export async function executeThemePush(
  flags: Omit<PushFlags, 'json' | 'strict'>,
  adminSession?: AdminSession,
  multiEnvironment?: boolean,
  context?: {stdout?: Writable; stderr?: Writable},
) {
  const environment = flags.environment?.[0]

  // when push is used programmatically, we don't have an admin session, so need to create one
  const session =
    adminSession ?? (await ensureAuthenticatedThemes(ensureThemeStore({store: flags.store}), flags.password))

  recordTiming('theme-service:push:setup')

  configureCLIEnvironment({
    verbose: flags.verbose,
    noColor: flags.noColor,
  })

  const force = flags.force ?? false

  const workingDirectory = flags.path ? resolvePath(flags.path) : cwd()
  if (
    !(await hasRequiredThemeDirectories(workingDirectory)) &&
    !(await ensureDirectoryConfirmed(force, undefined, environment, multiEnvironment))
  ) {
    return
  }

  if (flags.listing) {
    await ensureListingExists(workingDirectory, flags.listing)
  }

  const selectedTheme: Theme | undefined = await createOrSelectTheme(session, flags, multiEnvironment)
  if (!selectedTheme) {
    return
  }

  recordTiming('theme-service:push:setup')

  return executePush(
    selectedTheme,
    session,
    {
      allowLive: flags.allowLive ?? false,
      environment,
      force,
      ignore: flags.ignore ?? [],
      multiEnvironment,
      nodelete: flags.nodelete ?? false,
      only: flags.only ?? [],
      path: workingDirectory,
      publish: flags.publish ?? false,
      listing: flags.listing,
    },
    context,
  )
}

/**
 * Executes the push operation for a specific theme.
 *
 * @param theme - the remote theme to be updated by the push command
 * @param session - the admin session to access the API and upload the theme
 * @param options - the options that modify how the theme gets uploaded
 */
async function executePush(
  theme: Theme,
  session: AdminSession,
  options: PushOptions,
  context?: {stdout?: Writable; stderr?: Writable},
) {
  recordTiming('theme-service:push:file-system')
  const themeChecksums = await fetchChecksums(theme.id, session)
  const themeFileSystem = mountThemeFileSystem(options.path, {
    filters: options,
    listing: options.listing,
  })
  recordTiming('theme-service:push:file-system')

  const {uploadResults, renderThemeSyncProgress} = uploadTheme(
    theme,
    session,
    themeChecksums,
    themeFileSystem,
    options,
    context,
  )

  await renderThemeSyncProgress()

  if (options.publish) {
    await themePublish(theme.id, session)
  }

  const errors: Record<string, string[]> = {}
  for (const [key, result] of uploadResults) {
    if (!result.success && result.errors?.asset) errors[key] = result.errors.asset
  }

  return themePushResultSchema.parse({
    environment: options.environment,
    theme: {
      id: theme.id,
      name: theme.name,
      role: theme.role,
      shop: session.storeFqdn,
      editor_url: themeEditorUrl(theme, session),
      preview_url: themePreviewUrl(theme, session),
    },
    published: options.publish ?? false,
    hasErrors: [...uploadResults.values()].some((result) => !result.success),
    errors,
  })
}

export async function createOrSelectTheme(
  session: AdminSession,
  flags: PushFlags,
  multiEnvironment?: boolean,
): Promise<Theme | undefined> {
  const {live, development, unpublished, theme, environment, developmentContext} = flags

  if (development) {
    const themeManager = new DevelopmentThemeManager(session)
    return themeManager.findOrCreate(developmentContext, DEVELOPMENT_THEME_ROLE)
  } else if (unpublished) {
    const themeName = theme ?? (await promptThemeName('Name of the new theme'))
    return themeCreate(
      {
        name: themeName,
        role: UNPUBLISHED_THEME_ROLE,
      },
      session,
    )
  } else {
    const selectedTheme = await findOrSelectTheme(session, {
      create: true,
      header: 'Select a theme to push to:',
      filter: {
        live,
        theme,
      },
    })

    const confirmed = await confirmPushToTheme(
      selectedTheme.role as Role,
      flags.allowLive,
      session.storeFqdn,
      environment,
      multiEnvironment,
    )
    return confirmed ? selectedTheme : undefined
  }
}

async function confirmPushToTheme(
  themeRole: Role,
  allowLive: boolean | undefined,
  storeFqdn: string,
  environment?: string[],
  multiEnvironment?: boolean,
) {
  if (themeRole === LIVE_THEME_ROLE) {
    if (allowLive) {
      return true
    }

    if (multiEnvironment) {
      const body = [
        `Can't push theme files to the live theme on ${storeFqdn}`,
        'Use the --allow-live flag to push to a live theme.',
      ]
      if (commandEventOutputMode() === 'json') {
        emitCommandEvent({
          type: 'diagnostic',
          level: 'error',
          message: `Environment: ${environment}\n${body.join('\n')}`,
        })
      } else {
        renderError({headline: `Environment: ${environment}`, body})
      }
      return false
    }

    const options: RenderConfirmationPromptOptions = {
      message: `Push theme files to the ${themeRole} theme on ${storeFqdn}?`,
      confirmationMessage: 'Yes, confirm changes',
      cancellationMessage: 'Cancel',
    }

    return renderConfirmationPrompt(options)
  }
  return true
}

/** Compatibility adapter for callers of the exported theme API. */
export async function push(
  flags: PushFlags,
  adminSession?: AdminSession,
  multiEnvironment?: boolean,
  context?: {stdout?: Writable; stderr?: Writable},
): Promise<void> {
  const session =
    adminSession ?? (await ensureAuthenticatedThemes(ensureThemeStore({store: flags.store}), flags.password))
  await checkThemeBeforePush(flags, true)
  const result = await executeThemePush(flags, session, multiEnvironment, context)
  if (result) renderThemePushResult(result, flags.json ? 'json' : 'text')
}
