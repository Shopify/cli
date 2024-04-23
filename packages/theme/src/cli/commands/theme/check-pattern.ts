import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {mountThemeFileSystem} from '../../utilities/theme-fs.js'
import {listMatchedFiles} from '../../utilities/asset-ignore.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {Checksum, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
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

    if (flags.path) {
      const themeFileSystem: ThemeFileSystem = await mountThemeFileSystem(flags.path)
      const files: Checksum[] = Array.from(themeFileSystem.files.values())

      const matches: {[key: string]: string[]} = {}
      flags.pattern.forEach((pattern) => {
        const matchedFiles = listMatchedFiles(files, pattern)
        matches[pattern] = matchedFiles
      })

      if (flags.json) {
        outputInfo(JSON.stringify(matches))
      } else {
        const messageBody: TokenItem = []
        Object.entries(matches).forEach(([pattern, files], index) => {
          messageBody.push({
            list: {
              title: {
                bold: `Pattern: ${pattern}`,
              },
              items: files,
            },
          })
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
}
