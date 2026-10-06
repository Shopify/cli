import {ThemeDeleteResult} from './delete/types.js'
import {removeDevelopmentTheme} from './local-storage.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {themeComponent} from '../utilities/theme-ui.js'
import {findOrSelectTheme, findThemes} from '../utilities/theme-selector.js'
import {themeDelete} from '@shopify/cli-kit/node/themes/api'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {
  renderConfirmationPrompt,
  RenderConfirmationPromptOptions,
  InlineToken,
  LinkToken,
} from '@shopify/cli-kit/node/ui'
import {pluralize} from '@shopify/cli-kit/common/string'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {isDevelopmentTheme} from '@shopify/cli-kit/node/themes/utils'
import {AbortError} from '@shopify/cli-kit/node/error'

interface DeleteOptions {
  selectTheme: boolean
  development: boolean
  force: boolean
  themes: string[]
}

export async function themesDelete(
  adminSession: AdminSession,
  options: DeleteOptions,
  multiEnvironment?: boolean,
): Promise<ThemeDeleteResult | undefined> {
  let themeIds = options.themes
  if (options.development) {
    const theme = await new DevelopmentThemeManager(adminSession).find()
    themeIds = [theme.id.toString()]
  }

  const store = adminSession.storeFqdn
  const themes = await findThemesByDeleteOptions(adminSession, {...options, themes: themeIds, development: false})

  if (!options.force && !multiEnvironment && !(await isConfirmed(themes, store))) {
    return
  }

  const deletions = await Promise.allSettled(
    themes.map(async (theme) => {
      await themeDelete(theme.id, adminSession)
      if (isDevelopmentTheme(theme)) removeDevelopmentTheme()
      return {...theme, shop: store}
    }),
  )
  const deletedThemes = deletions.flatMap((deletion) => (deletion.status === 'fulfilled' ? [deletion.value] : []))
  const errors = deletions.flatMap((deletion, index) => {
    if (deletion.status === 'fulfilled') return []
    const error: unknown = deletion.reason
    return [{themeId: themes[index]!.id, message: error instanceof Error ? error.message : String(error)}]
  })
  if (errors.length > 0 && deletedThemes.length === 0) {
    const error = new AbortError(errors[0]!.message)
    error.details = {errors: errors.map(({themeId, message}) => ({themeId: String(themeId), message}))}
    throw error
  }
  return {
    status: errors.length > 0 ? 'partial' : 'success',
    themes: deletedThemes,
    ...(errors.length > 0 ? {errors} : {}),
  }
}

async function findThemesByDeleteOptions(adminSession: AdminSession, options: DeleteOptions) {
  if (options.selectTheme || options.themes.length > 0) {
    return findThemes(adminSession, options)
  }

  const store = adminSession.storeFqdn
  const theme = await findOrSelectTheme(adminSession, {
    header: `Select a theme to delete from ${store}`,
    filter: {development: options.development},
  })

  return [theme]
}

async function isConfirmed(themes: Theme[], store: string) {
  const message = pluralize<Theme, Exclude<InlineToken, LinkToken>>(
    themes,
    (_themes) => [`Delete the following themes from ${store}?`],
    (theme) => ['Delete', ...themeComponent(theme), `from ${store}?`],
  )

  const options: RenderConfirmationPromptOptions = {
    message,
    confirmationMessage: 'Yes, confirm changes',
    cancellationMessage: 'Cancel',
  }

  if (themes.length > 1) {
    options.infoTable = {'': themes.map(themeComponent)}
  }

  return renderConfirmationPrompt(options)
}
