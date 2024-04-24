import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {checkPatterns} from '../../services/check-patterns.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {TokenItem, renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class CheckPattern extends ThemeCommand {
  static description = 'Returns a list of theme files that match a given fileignore pattern.'

  static flags = {
    ...globalFlags,
    ...themeFlags,
    pattern: Flags.string({
      char: 'x',
      description: 'The glob or regex pattern used for matching your theme files',
      env: 'SHOPIFY_FLAG_IGNORE',
      required: true,
      multiple: true,
    }),
    json: Flags.boolean({
      hidden: false,
      description: 'format output as JSON',
      env: 'SHOPIFY_FLAG_JSON',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(CheckPattern)

    const matches = await checkPatterns(flags.path, flags.pattern)

    if (flags.json) {
      outputInfo(JSON.stringify(matches))
    } else {
      const messageBody: TokenItem = []
      Object.entries(matches).forEach(([pattern, files], index) => {
        if (files.length === 0) {
          messageBody.push(`No matches for: ${pattern}`)
        } else {
          messageBody.push({
            list: {
              title: {
                bold: `Matches for: ${pattern}`,
              },
              items: files,
            },
          })
        }

        if (index < Object.keys(matches).length - 1) {
          messageBody.push('\n')
        }
      })
      renderSuccess({
        headline: 'Theme file pattern matching results:',
        body: messageBody,
      })
    }
  }
}
