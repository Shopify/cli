import {jsonOutputEnabled} from './environment.js'
import {currentProcessIsGlobal} from './is-global.js'
import {renderInfo} from './ui.js'
import {globalCLIVersion, localCLIVersion} from './version.js'
import {CLI_KIT_VERSION} from '../common/version.js'
import {runAtMinimumInterval} from '../../private/node/conf-store.js'

/**
 * Shows a warning if there are two Shopify CLI installations found (global and local).
 * Won't show anything if the user included the --json flag.
 *
 * @param directory - The directory of the project.
 * @param dependencies - The dependencies of the project.
 */
export async function showMultipleCLIWarningIfNeeded(
  directory: string,
  dependencies: {[key: string]: string},
): Promise<void> {
  // Show the warning only once per day
  await runAtMinimumInterval('warn-on-multiple-versions', {days: 1}, async () => {
    if (!dependencies['@shopify/cli'] || jsonOutputEnabled()) return

    const isGlobal = currentProcessIsGlobal()

    // If running globally, use the current CLI version, otherwise fetch the global CLI version
    // Exit early if we can't get the global version
    const globalVersion = isGlobal ? CLI_KIT_VERSION : await globalCLIVersion()
    if (!globalVersion) return

    // If running globally, fetch the local version from npm list, otherwise use current CLI version
    // Exit early if we can't get the local version
    const localVersion = isGlobal ? await localCLIVersion(directory) : CLI_KIT_VERSION
    if (!localVersion) return

    const currentInstallation = isGlobal ? 'global installation' : 'local dependency'

    const warningContent = {
      headline: `Two Shopify CLI installations found – using ${currentInstallation}`,
      body: [
        `A global installation (v${globalVersion}) and a local dependency (v${localVersion}) were detected.
We recommend removing the @shopify/cli and @shopify/app dependencies from your package.json, unless you want to use different versions across multiple apps.`,
      ],
      link: {
        label: 'See Shopify CLI documentation.',
        url: 'https://shopify.dev/docs/apps/build/cli-for-apps#switch-to-a-global-executable-or-local-dependency',
      },
    }
    renderInfo(warningContent)
  })
}
