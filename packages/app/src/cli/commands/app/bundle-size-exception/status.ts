import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {bundleSizeExceptionStatus} from '../../../services/bundle-size-exception.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class BundleSizeExceptionStatus extends AppLinkedCommand {
  static hidden = true

  static summary = "Check the state of the app's bundle size exception request."

  static descriptionWithMarkdown = `Shows whether the app has a Remote-DOM UI extension bundle size exception, a request pending review, or a denied request, along with the app's current bundle size limit.

  Use \`shopify app bundle-size-exception request\` to request an exception.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(BundleSizeExceptionStatus)

    const appContextResult = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    await bundleSizeExceptionStatus({appContextResult})

    return {app: appContextResult.app}
  }
}
