import {renderInfo} from '@shopify/cli-kit/node/ui'
import {currentProcessIsGlobal} from '@shopify/cli-kit/node/is-global'
import {globalCLIVersion, localCLIVersion} from '@shopify/cli-kit/node/version'
import {jsonOutputEnabled} from '@shopify/cli-kit/node/environment'

export async function showMultipleCLIWarningIfNeeded(directory: string, dependencies: {[key: string]: string}) {
  // Show the warning if:
  // - There is a global installation
  // - The project has a local CLI dependency
  // - The user didn't include the --json flag (to avoid showing the warning in scripts or CI/CD pipelines)

  const localVersion = dependencies['@shopify/cli'] && (await localCLIVersion(directory))
  const globalVersion = await globalCLIVersion()

  if (localVersion && globalVersion && !jsonOutputEnabled()) {
    const currentInstallation = currentProcessIsGlobal() ? 'global installation' : 'local dependency'

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
  }
}
