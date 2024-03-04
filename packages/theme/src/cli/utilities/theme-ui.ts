import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderConfirmationPrompt, renderWarning} from '@shopify/cli-kit/node/ui'

export function themeComponent(theme: Theme) {
  return [
    `'${theme.name}'`,
    {
      subdued: `(#${theme.id})`,
    },
  ]
}

export function themesComponent(themes: Theme[]) {
  const items = themes.map(themeComponent)

  return {list: {items}}
}

export async function currentDirectoryConfirmed(force: boolean) {
  if (force) {
    return true
  }

  renderWarning({body: `It doesn't seem like you're running this command in a theme directory.`})

  if (!process.stdout.isTTY) {
    return true
  }

  return renderConfirmationPrompt({
    message: 'Do you want to proceed?',
  })
}
