import {clearNextDeprecationDate, getNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {Command} from '@oclif/core'

/**
 * Before a command run, clears the `nextDeprecationDate`
 * in case it was set on a previously failed run.
 */
export const prerun = (): void => {
  clearNextDeprecationDate()
}

/**
 * After a successful command run, if `nextDeprecationDate` is present,
 * renders an upgrade warning, and clears the `nextDeprecationDate`.
 *
 * @param Command - The class of the command that was run.
 */
export const postrun = (Command: Command.Class): void => {
  const nextDeprecationDate = getNextDeprecationDate()
  if (nextDeprecationDate) {
    const forThemes = Command?.id?.includes('theme')
    renderUpgradeWarning(nextDeprecationDate, forThemes)
    clearNextDeprecationDate()
  }
}

/**
 * Renders a warning to upgrade to avoid using deprecated features
 * that will no longer be supported after the specified date.
 *
 * @param upgradeByDate - The earliest future date when deprecated features will no longer be supported.
 * @param forThemes - If true, references the upgrade link for themes, else for apps.
 */
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
