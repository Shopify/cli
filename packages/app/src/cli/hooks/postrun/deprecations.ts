import {clearNextDeprecationDate, getNextDeprecationDate} from '../../private/node/deprecations/store.js'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {Command} from '@oclif/core'

export const hook = (Command: Command.Class) => {
  const nextDeprecationDate = getNextDeprecationDate()
  if (nextDeprecationDate) {
    const forThemes = Command?.id?.includes('theme')
    renderUpgradeWarning(nextDeprecationDate, forThemes)
    clearNextDeprecationDate()
  }
}

function renderUpgradeWarning(upgradeByDate: Date, forThemes?: boolean): void {
  const dateFormat = new Intl.DateTimeFormat('default', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const formattedDate = dateFormat.format(upgradeByDate)

  const headline = `Upgrade to the latest CLI version by ${formattedDate}.`
  const body = 'This command is using deprecated internal APIs that will no longer be supported.'
  const upgradeLink = {
    link: {
      label: 'upgrade Shopify CLI',
      url: forThemes
        ? `https://shopify.dev/docs/themes/tools/cli#upgrade-shopify-cli`
        : `https://shopify.dev/docs/apps/tools/cli#upgrade-shopify-cli`,
    },
  }
  const nextSteps = [['Run', {command: 'upgrade'}, 'to', upgradeLink]]

  renderWarning({
    headline,
    body,
    nextSteps,
  })
}
