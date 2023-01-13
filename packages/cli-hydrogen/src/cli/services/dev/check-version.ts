import {checkForNewVersion} from '@shopify/cli-kit/node/node-package-manager'
import {captureOutput} from '@shopify/cli-kit/node/system'
import {renderInfo} from '@shopify/cli-kit/node/ui'

const PACKAGE_NAME = '@shopify/hydrogen'

export async function checkHydrogenVersion(directory: string): Promise<string | undefined> {
  const currentVersion = await captureOutput(
    'node',
    ['-p', `require('./node_modules/${PACKAGE_NAME}/package.json').version`],
    {
      cwd: directory,
    },
  )

  if (!currentVersion) {
    return
  }

  const newVersionAvailable = await checkForNewVersion(PACKAGE_NAME, currentVersion)

  if (newVersionAvailable) {
    renderInfo({
      headline: 'Upgrade available',
      body:
        `Version ${newVersionAvailable} of ${PACKAGE_NAME} is now available.\n\n` +
        `You are currently running v${currentVersion}.`,
      reference: [
        {
          link: {
            label: 'Hydrogen releases',
            url: 'https://github.com/Shopify/hydrogen/releases',
          },
        },
      ],
    })

    return newVersionAvailable
  }
}
