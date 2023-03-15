import {reportAnalyticsEvent} from '../analytics.js'
import {outputDebug} from '../../../public/node/output.js'
import {clearNextDeprecationDate, getNextDeprecationDate} from '../../../private/node/conf-store.js'
import {renderWarning} from '../ui.js'
import {Hook} from '@oclif/core'

// This hook is called after each successful command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Postrun = async ({config, Command}) => {
  await reportAnalyticsEvent({config})
  const command = Command?.id?.replace(/:/g, ' ')
  outputDebug(`Completed command ${command}`)

  const nextDeprecationDate = getNextDeprecationDate()
  if (nextDeprecationDate) {
    const forThemes = command.includes('theme')
    renderUpgradeWarning(nextDeprecationDate, forThemes)
    clearNextDeprecationDate()
  }
}

export const renderUpgradeWarning = (upgradeByDate: Date, forThemes?: boolean): void => {
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
