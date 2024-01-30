import {appFlags} from '../../flags.js'
import {loadApp} from '../../models/app/loader.js'
import Command from '../../utilities/app-command.js'
// import metadata from '../../metadata.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
// import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {joinPath} from '@shopify/cli-kit/node/path'
import {glob, readFile} from '@shopify/cli-kit/node/fs'
import {renderWarning} from '@shopify/cli-kit/node/ui'

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

    const app = await loadApp({directory: flags.path})
    const {webs} = app
    const remixApp = webs.find((web) => web.framework === 'remix')
    if (remixApp) {
      const serverPath = joinPath(remixApp.directory, 'app/shopify.server.{js,ts}')
      let serverFiles = await glob(serverPath, {ignore: ['**.d.ts', '**.test.ts']})
      if (serverFiles.length === 0) {
        console.log('no server file')
      }
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
  }
}
