import {deleteTheme} from '../utilities/themes-api.js'
import {Theme} from '../models/theme.js'
import {pluralized} from '../utilities/pluralized.js'
import {session} from '@shopify/cli-kit'
import * as uix from '@shopify/cli-kit/node/ui'

export async function deleteThemes(themes: Theme[], adminSession: session.AdminSession, force = false) {
  const store = adminSession.storeFqdn

  if (force && (await isConfirmed(themes, store))) {
    themes.map((theme) => deleteTheme(theme.id, adminSession))
  }

  await renderSuccess(themes, store)
}

export function renderArgumentsWarning(argv: string[]) {
  const ids = argv.reduce((acc, id) => `${acc} ${id}`)

  const lines = [
    `The positional arguments are deprecated. Use the \`--theme\` flag: \`shopify delete delete --theme ${ids}\``,
  ]

  uix.renderWarning({
    headline: lines.join('\n'),
  })
}

async function isConfirmed(themes: Theme[], store: string) {
  const question = pluralized(themes, {
    singular: (theme) => `Delete ${theme.name} (#${theme.id}) from ${store}?`,
    plural: (themes) => asText([`Delete the following themes from ${store}?`, '', listOfThemes(themes), '']),
  })

  return uix.renderConfirmation({
    question,
  })
}

async function renderSuccess(themes: Theme[], store: string) {
  const headline = pluralized(themes, {
    singular: (theme) => `The theme ${theme.name} (#${theme.id}) was deleted from ${store}`,
    plural: (themes) => asText([`The following themes were deleted from ${store}`, '', listOfThemes(themes)]),
  })

  uix.renderSuccess({
    headline,
  })
}

function listOfThemes(themes: Theme[]) {
  const fmtTheme = (theme: Theme) => `  • ${theme.name} (#${theme.id})`

  return asText(['', ...themes.map(fmtTheme)])
}

function asText(lines: string[]): string {
  return lines.join('\n')
}
