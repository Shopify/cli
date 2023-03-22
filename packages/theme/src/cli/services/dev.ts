import {renderConfirmationPrompt, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'
import {access} from 'node:fs/promises'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = '9292'

export function renderLinks(store: string, themeId: string, host = DEFAULT_HOST, port = DEFAULT_PORT) {
  renderSuccess({
    body: [
      {
        list: {
          title: 'Preview your theme',
          items: [
            {
              link: {
                url: `http://${host}:${port}`,
              },
            },
          ],
        },
      },
    ],
    nextSteps: [
      [
        {
          link: {
            label: 'Customize your theme at the theme editor',
            url: `https://${store}/admin/themes/${themeId}/editor`,
          },
        },
      ],
      [
        {
          link: {
            label: 'Share your theme preview',
            url: `https://${store}/?preview_theme_id=${themeId}`,
          },
        },
      ],
    ],
  })
}

export const REQUIRED_FOLDERS = ['config', 'layout', 'sections', 'templates']

export function validThemeDirectory(currentDirectory: string): Promise<boolean> {
  return new Promise((resolve) => {
    Promise.all(REQUIRED_FOLDERS.map((requiredFolder) => access(joinPath(currentDirectory, requiredFolder))))
      .then(() => resolve(true))
      .catch(() => resolve(false))
  })
}

export function currentDirectoryConfirmed(force: boolean) {
  if (force) {
    return true
  }

  renderWarning({body: 'It doesn’t seem like you’re running this command in a theme directory.'})

  if (!process.stdout.isTTY) {
    return true
  }

  return renderConfirmationPrompt({
    message: 'Are you sure you want to proceed?',
  })
}
