import {analyzeBundle} from '../../../services/extension/analyze-bundle.js'
import {appFlags} from '../../../flags.js'
import AppUnlinkedCommand, {AppUnlinkedCommandOutput} from '../../../utilities/app-unlinked-command.js'
import {localAppContext} from '../../../services/app-context.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class ExtensionAnalyzeBundle extends AppUnlinkedCommand {
  static summary = 'Analyze the bundle composition of UI extensions.'

  static descriptionWithMarkdown = `Analyzes the bundle of UI extensions to show dependency sizes, package composition, and overall bundle size. Supports text, JSON, and interactive HTML output.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
    extension: Flags.string({
      char: 'e',
      description: 'Extension handle to analyze. Omit to analyze all extensions.',
      env: 'SHOPIFY_FLAG_EXTENSION',
    }),
    html: Flags.boolean({
      description: 'Generate an interactive HTML treemap report and open it in the browser.',
      default: false,
      exclusive: ['json'],
    }),
  }

  public async run(): Promise<AppUnlinkedCommandOutput> {
    const {flags} = await this.parse(ExtensionAnalyzeBundle)

    const app = await localAppContext({
      directory: flags.path,
      userProvidedConfigName: flags.config,
    })

    await analyzeBundle({
      app,
      extensionHandle: flags.extension,
      json: flags.json,
      html: flags.html,
    })

    return {app}
  }
}
