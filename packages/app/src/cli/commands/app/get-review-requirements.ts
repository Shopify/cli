import {getReviewRequirements} from '../../services/app/get-review-requirements.js'
import {appFlags} from '../../flags.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'

export default class AppGetReviewRequirements extends BaseCommand {
  static summary = 'Print the App Store self-review requirements as markdown.'

  static descriptionWithMarkdown = `Prints the [App Store review requirements](https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements) to stdout as markdown, including the agent verification guidance an AI agent needs to evaluate each requirement against a local codebase.

  Designed to be invoked by the \`shopify-app-review\` agent skill from the Shopify AI Toolkit as part of a local pre-submission compliance check, but you can also run it yourself to read the latest locally checkable requirements.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: appFlags.path,
    config: appFlags.config,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AppGetReviewRequirements)

    const markdown = await getReviewRequirements({
      directory: flags.path,
      configName: flags.config,
    })

    outputResult(markdown)
  }
}
