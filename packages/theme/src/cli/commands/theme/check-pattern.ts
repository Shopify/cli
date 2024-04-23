import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {mountThemeFileSystem} from '../../utilities/theme-fs.js'
import {listMatchedFiles} from '../../utilities/asset-ignore.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {Checksum, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
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
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(CheckPattern)

    if (flags.path) {
      const themeFileSystem: ThemeFileSystem = await mountThemeFileSystem(flags.path)
      const fileNames: Checksum[] = Array.from(themeFileSystem.files.values())
      const matchedFiles = listMatchedFiles(fileNames, flags.pattern)
      outputInfo(matchedFiles.map((file) => `- ${file}`).join('\n'))
    }
  }
}
