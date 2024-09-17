import {Theme} from '@shopify/cli-kit/node/themes/types'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderInfo, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {pullTheme} from '@shopify/cli-kit/node/themes/themes-api'
import {themeComponent} from '@shopify/cli-kit/node/themes/theme-components'
import {AbortError} from '@shopify/cli-kit/node/error'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, mkdir} from '@shopify/cli-kit/node/fs'

interface PullOptions {
  path: string
  nodelete?: boolean
  only?: string[]
  ignore?: string[]
  force?: boolean
}

export async function pull(theme: Theme, adminSession: AdminSession, options: PullOptions) {
  const directory = options.path

  if (!(await fileExists(directory))) {
    await mkdir(directory)
  }

  const componentResults = await pullTheme(theme, adminSession, {
    directory,
    nodelete: options.nodelete,
    only: options.only,
    ignore: options.ignore,
  })

  const tasks = componentResults.map((result) => {
    return {
      title: `Pulling theme files from ${result.name}`,
      task: async () => {
        if (result.errors.length > 0) {
          throw new AbortError(result.errors.join('\n'))
        }
      },
    }
  })

  await renderTasks(tasks)

  const componentNames = componentResults.map((result) => result.name)
  const components = componentNames.map((name) => themeComponent(name))

  renderSuccess({
    body: ['Your theme has been pulled successfully'],
    nextSteps: [
      ['To preview your changes, run', {command: `cd ${basename(directory)}`}, 'and', {command: 'shopify theme serve'}],
    ],
  })

  renderInfo({
    body: [
      {
        list: {
          items: components.map((component) => ({
            link: {
              label: component.name,
              url: joinPath(directory, component.directory),
            },
          })),
        },
      },
    ],
  })
}
