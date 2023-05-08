import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {renderWarning} from '@shopify/cli-kit/node/ui'

function link(packageManager: PackageManager) {
  switch (packageManager) {
    case 'npm':
      return 'https://docs.npmjs.com/cli/v7/using-npm/workspaces'
    case 'yarn':
      return 'https://classic.yarnpkg.com/lang/en/docs/workspaces/'
    case 'pnpm':
      return 'https://pnpm.io/workspaces'
  }
}

export function showWorkspaceWarning(packageManager: PackageManager) {
  renderWarning({
    headline: 'Dependency installation behavior soon to change.',
    body: [
      'The CLI will soon stop installing dependencies in project subdirectories by default. ' +
        'To maintain the same behavior, please transition over to using workspaces.',
    ],
    reference: [
      [
        {
          link: {
            url: link(packageManager),
            label: `${packageManager} workspaces`,
          },
        },
      ],
    ],
  })
}
