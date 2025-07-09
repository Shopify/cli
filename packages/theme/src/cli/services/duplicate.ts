import {themeComponent} from '../utilities/theme-ui.js'
import {configureCLIEnvironment} from '../utilities/cli-config.js'
import {findOrSelectTheme, findThemeById} from '../utilities/theme-selector.js'
import {renderConfirmationPrompt, renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {themePreviewUrl} from '@shopify/cli-kit/node/themes/urls'
import {themeDuplicate, ThemeDuplicateResult} from '@shopify/cli-kit/node/themes/api'
import {isCI} from '@shopify/cli-kit/node/system'

interface DuplicateFlags {
  /** Password generated from the Theme Access app. */
  password?: string

  /** Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com, https://example.myshopify.com). */
  store?: string

  /** Theme ID */
  theme?: string

  /** Output JSON instead of UI. */
  json?: boolean

  /** Disable color output. */
  noColor?: boolean

  /** Increase the verbosity of the output. */
  verbose?: boolean

  /** name the duplicated theme. */
  name?: string

  /** Environment */
  environment?: string[] | undefined

  /** Force the duplicate operation to run without prompts or confirmations. */
  force?: boolean
}

/**
 * Initiates the duplicate process based on provided flags.
 *
 * @param adminSession - The admin session for the theme.
 * @param theme - The theme to duplicate.
 * @param flags - The flags for the duplicate operation.
 */
export async function duplicate(adminSession: AdminSession, themeId: string | undefined, flags: DuplicateFlags) {
  const {name, verbose, noColor, json, force} = flags
  const noPrompts = isCI() || force

  configureCLIEnvironment({
    verbose,
    noColor,
  })

  if (noPrompts && !themeId) {
    const message = 'A theme ID is required to duplicate a theme, specify one with the --theme flag'
    json ? outputResult(JSON.stringify({message, errors: []})) : renderError({body: [message]})
    return
  }

  const themeToDuplicate = themeId
    ? await findThemeById(adminSession, themeId)
    : await findOrSelectTheme(adminSession, {
        header: 'Select a theme to duplicate',
        filter: {
          theme: themeId,
        },
      })

  if (!themeToDuplicate) {
    const message = `No theme with ID ${themeId} could be found. Use shopify theme list to find a theme ID.`
    json ? outputResult(JSON.stringify({message, errors: []})) : renderError({body: [message]})
    return
  }

  if (themeToDuplicate?.role === 'development') {
    const message = "Development themes can't be duplicated. Use shopify theme push to upload it to the store first."
    json ? outputResult(JSON.stringify({message, errors: []})) : renderError({body: [message]})
    return
  }

  if (!noPrompts) {
    const accept = await renderConfirmationPrompt({
      message: `Do you want to duplicate '${themeToDuplicate.name}' on ${adminSession.storeFqdn}?`,
      confirmationMessage: `Yes, duplicate '${themeToDuplicate.name}'`,
      cancellationMessage: 'No, cancel duplicate',
    })
    if (!accept) return
  }

  const result = await themeDuplicate(themeToDuplicate.id, name, adminSession)

  json ? handleJsonOutput(themeToDuplicate, adminSession, result) : handleOutput(themeToDuplicate, adminSession, result)
}

/**
 * Handles the output for the duplicate operation.
 *
 * @param theme - The theme being duplicated.
 * @param session - The admin session for the theme.
 * @param result - The results of duplication.
 */
function handleOutput(theme: Theme, session: AdminSession, result: ThemeDuplicateResult) {
  if (result.userErrors && result.userErrors.length > 0) {
    const errors = result.userErrors
      .map((error: {field?: string[] | null; message: string}) => error.message)
      .join(', ')
    renderError({
      body: [
        'The theme',
        ...themeComponent(theme),
        'could not be duplicated due to errors: ',
        {subdued: errors},
        {char: '.'},
        ...(result.requestId ? ['\nRequest ID: ', {subdued: result.requestId}] : []),
      ],
    })
  } else if (result.theme) {
    renderSuccess({
      body: ['The theme', ...themeComponent(theme), 'has been duplicated', {char: '.'}],
      nextSteps: [
        [
          {
            link: {
              label: 'View the duplicated theme',
              url: themePreviewUrl(result.theme, session),
            },
          },
        ],
      ],
    })
  } else {
    renderError({
      body: [
        'The theme',
        ...themeComponent(theme),
        'unexpectedly could not be duplicated',
        {char: '.'},
        ...(result.requestId ? ['\nRequest ID: ', {subdued: result.requestId}] : []),
      ],
    })
  }
}

/**
 * Handles the JSON output for the duplicate operation.
 *
 * @param theme - The theme being duplicated.
 * @param session - The admin session for the theme.
 * @param result - The results of duplication.
 */
function handleJsonOutput(theme: Theme, session: AdminSession, result: ThemeDuplicateResult) {
  if (result.userErrors && result.userErrors.length > 0) {
    outputResult(
      JSON.stringify({
        message: `The theme '${theme.name}' could not be duplicated due to errors`,
        errors: result.userErrors.map((error: {field?: string[] | null; message: string}) => error.message),
        requestId: result.requestId,
      }),
    )
  } else if (result.theme) {
    const {id, name, role} = result.theme

    const output = {
      theme: {
        id,
        name,
        role,
        shop: session.storeFqdn,
      },
    }

    outputResult(JSON.stringify(output))
  } else {
    outputResult(
      JSON.stringify({
        message: `The theme '${theme.name}' unexpectedly could not be duplicated `,
        errors: [],
        requestId: result.requestId,
      }),
    )
  }
}
