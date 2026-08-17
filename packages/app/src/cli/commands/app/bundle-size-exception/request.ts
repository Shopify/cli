import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {requestBundleSizeException} from '../../../services/bundle-size-exception.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class BundleSizeExceptionRequest extends AppLinkedCommand {
  static hidden = true

  static summary = "Request a bundle size exception for the app's Remote-DOM UI extensions."

  static descriptionWithMarkdown = `Remote-DOM UI extension bundles (API version 2025-10 or later) are limited to 64 KB (compressed). If you can't reduce your bundle below the limit, you can ask Shopify for a bundle size exception.

  The command measures each Remote-DOM UI extension bundle locally (using the same compression the platform enforces), collects your justification, and submits the request. Shopify reviews every request; once approved, \`shopify app deploy\` succeeds with no further changes.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    reason: Flags.string({
      description:
        "Why the bundle can't be reduced below the current limit. When provided, the command runs non-interactively.",
      env: 'SHOPIFY_FLAG_BUNDLE_SIZE_EXCEPTION_REASON',
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(BundleSizeExceptionRequest)

    const appContextResult = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    await requestBundleSizeException({appContextResult, reason: flags.reason})

    return {app: appContextResult.app}
  }
}
