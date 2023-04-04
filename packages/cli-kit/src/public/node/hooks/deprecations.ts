import {Deprecation, getDeprecation, resetDeprecation} from '../../../private/node/context/deprecations-store.js'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {Command} from '@oclif/core'

/**
 * After a successful command run, renders an upgrade warning if `nextDeprecationDate` is present.
 *
 * @param Command - The class of the command that was run.
 */
export const postrun = (Command: Command.Class): void => {
  const deprecation = getDeprecation()
  if (deprecation) {
    const forThemes = Command?.id?.includes('theme')
    renderUpgradeWarning(deprecation, forThemes)
    resetDeprecation()
  }
}

const dateFormat = new Intl.DateTimeFormat('default', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

/**
 * Renders a warning to upgrade to avoid using deprecated features
 * that will no longer be supported (after the specified date, if present).
 *
 * @param deprecation - The next deprecation.
 * @param forThemes - If true, references the upgrade link for themes, else for apps.
 */
function renderUpgradeWarning(deprecation: Deprecation, forThemes?: boolean): void {
  let headline

  if ('date' in deprecation) {
    const formattedDate = dateFormat.format(deprecation.date)
    headline = `Upgrade to the latest CLI version by ${formattedDate}`
  } else {
    headline = 'Upgrade to the latest CLI version'
  }

  const body = 'This command requires an upgrade to continue working as intended.'
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
