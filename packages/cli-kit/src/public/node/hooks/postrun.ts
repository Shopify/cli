import {reportAnalyticsEvent} from '../analytics.js'
import {outputDebug} from '../../../public/node/output.js'
import {Hook} from '@oclif/core'
import {clearDeprecations, getDeprecations} from '../../../private/node/conf-store.js'
import {renderWarning} from '../ui.js'

// This hook is called after each successful command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Postrun = async ({config, Command}) => {
  await reportAnalyticsEvent({config})
  const command = Command?.id?.replace(/:/g, ' ')
  outputDebug(`Completed command ${command}`)

  const deprecations = getDeprecations()
  if (deprecations.length > 0) {
    const forThemes = command.includes('theme')
    renderUpgradeWarning(new Date(deprecations[0] as string), forThemes)
    clearDeprecations()
  }
}

const renderUpgradeWarning = (upgradeByDate: Date, forThemes?: boolean) => {
  const dateFormat = new Intl.DateTimeFormat('default', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const date = dateFormat.format(upgradeByDate)

  const headline = `Upgrade your Shopify CLI by ${date}.`
  const body = `This command is using deprecated APIs that will be removed.`
  const upgradeLink = {
    link: {
      label: 'Upgrade Shopify CLI',
      url: forThemes
        ? `https://shopify.dev/docs/themes/tools/cli#upgrade-shopify-cli`
        : `https://shopify.dev/docs/apps/tools/cli#upgrade-shopify-cli`,
    },
  }

  renderWarning({
    headline,
    body,
    reference: [upgradeLink],
  })
}
