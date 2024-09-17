import {Theme} from '@shopify/cli-kit/node/themes/types'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderInfo, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {pushTheme} from '@shopify/cli-kit/node/themes/themes-api'
import {themeComponent} from '@shopify/cli-kit/node/themes/theme-components'
import {AbortError} from '@shopify/cli-kit/node/error'
import {basename, joinPath} from '@shopify/cli-kit/node/path'

interface PushOptions {
  path: string
  nodelete?: boolean
  publish?: boolean
  json?: boolean
  force?: boolean
  only?: string[]
  ignore?: string[]
}

export async function push(theme: Theme, adminSession: AdminSession, options: PushOptions) {
  const componentResults = await pushTheme(theme, adminSession, {
    directory: options.path,
    nodelete: options.nodelete,
    publish: options.publish,
    only: options.only,
    ignore: options.ignore,
  })

  const tasks = componentResults.map((result) => {
    return {
      title: `Pushing theme files to ${result.name}`,
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

  if (options.json) {
    const output = {
      theme: {
        id: theme.id,
        name: theme.name,
        role: theme.role,
        shop: adminSession.storeFqdn,
        editor_url: `https://${adminSession.storeFqdn}/admin/themes/${theme.id}/editor`,
        preview_url: `https://${adminSession.storeFqdn}/?preview_theme_id=${theme.id}`,
      },
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(output, null, 2))
  } else {
    renderSuccess({
      body: ['Your theme has been pushed successfully'],
      nextSteps: [
        [
          'To preview your changes, run',
          {command: `cd ${basename(options.path)}`},
          'and',
          {command: 'shopify theme serve'},
        ],
      ],
    })

    renderInfo({
      body: [
        {
          list: {
            items: components.map((component) => ({
              link: {
                label: component.name,
                url: joinPath(options.path, component.directory),
              },
            })),
          },
        },
      ],
    })
  }
}
