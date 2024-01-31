import {appFlags} from '../../flags.js'
import {loadApp} from '../../models/app/loader.js'
import {isCurrentAppSchema} from '../../models/app/app.js'
import Command from '../../utilities/app-command.js'
// import metadata from '../../metadata.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
// import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {joinPath} from '@shopify/cli-kit/node/path'
import {glob, readFile} from '@shopify/cli-kit/node/fs'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {captureOutput} from '@shopify/cli-kit/node/system'
import {decodeToml} from '@shopify/cli-kit/node/toml'

interface RemixRoute {
  path: string
  children?: RemixRoute[]
}

function traversedRemixRoutes(routes: RemixRoute[]): string[] {
  return routes.reduce((paths: string[], route: RemixRoute) => {
    if (typeof route.path === 'string') {
      paths.push(route.path)
    }
    if (route.children) {
      paths.push(...traversedRemixRoutes(route.children))
    }
    return paths
  }, [])
}

export default class Lint extends Command {
  static description = 'Lint your Shopify app for common reasons to reject from the app store.'

  static flags = {
    ...globalFlags,
    ...appFlags,
 }

  async run(): Promise<void> {
    const {flags} = await this.parse(Lint)

    // await metadata.addPublicMetadata(() => ({
    // }))

    const app = await loadApp({directory: flags.path, configName: flags.config})
    const {webs} = app
    const remixApp = webs.find((web) => web.framework === 'remix')
    if (!remixApp) {
      outputInfo('No remix app found, skipping linting')
      return
    }

    const serverPath = joinPath(remixApp.directory, 'app/shopify.server.{js,ts}')
    let serverFiles = await glob(serverPath, {ignore: ['**.d.ts', '**.test.ts']})
    if (serverFiles.length > 0) {
      const fileContents = await readFile(serverFiles[0]!)
      if (!fileContents.includes('billing')) {
        renderWarning({
          headline: 'Billing configuration not detected',
          body: [
            'Billing has not been set up for your app. Your app will not be able to charge merchants for usage in a manner compliant with app store regulations. For more information, see',
            {
              link: {
                url: 'https://shopify.dev/docs/api/shopify-app-remix/v1/apis/billing',
                label: 'Billing with Remix'
              },
            }
          ],
          reference: [
            {
              link: {
                url: 'https://shopify.dev/docs/apps/billing',
                label: 'Billing documentation'
              },
            }
          ],
        })
      }
    }

    const remixRoutes = JSON.parse(
      await captureOutput(
        app.packageManager,
        [
          'exec',
          'remix',
          'routes',
          app.packageManager === 'npm' ? '--' : '',
          '--json',
        ],
        {cwd: remixApp.directory}
      ),
    )
    const remixPaths = traversedRemixRoutes(remixRoutes).map((path: string) => new RegExp(`^/?${path.replace(/\/\*$/, '.*')}$`))

    if (isCurrentAppSchema(app.configuration)) {
      const appConfig = decodeToml(await readFile(joinPath(app.directory, 'shopify.app.toml'))) as {
        application_url: string
        auth?: {redirect_urls?: string[]}
      }

      const appHomePath = new URL(appConfig.application_url).pathname
      const appHomeRemixRoute = remixPaths.find((path: RegExp) => path.test(appHomePath))
      if (!appHomeRemixRoute) {
        renderWarning({
          headline: 'Application URL does not match any routes',
          body: [
            'The application URL you have configured does not match any of the routes in your app. This means that when a merchant installs your app, they will see an error page.',
          ],
        })
      }

      const oauthCallbackUrls = appConfig.auth?.redirect_urls?.map((url) => new URL(url).pathname)
      if (oauthCallbackUrls) {
        if (!oauthCallbackUrls.some((url) => remixPaths.some((path) => path.test(url)))) {
          renderWarning({
            headline: 'OAuth callback URLs not handled',
            body: [
              'Your app does not contain a handler for the registered OAuth callback URL(s). You must implement OAuth to authenticate merchants. For more information, see',
              {
                link: {
                  url: 'https://shopify.dev/docs/api/shopify-app-remix/v2/authenticate/admin',
                  label: 'Authentication with Remix'
                },
              }
            ],
            reference: [
              {
                link: {
                  url: 'https://shopify.dev/docs/apps/auth',
                  label: 'Authentication and authorization overview'
                },
              }
            ],
          })
        }
      }
    }
  }
}
