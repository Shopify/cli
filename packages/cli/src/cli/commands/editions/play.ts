import Command from '@shopify/cli-kit/node/base-command'
import {openURL} from '@shopify/cli-kit/node/system'
import {createRequire} from 'module'

/**
 * This command is used to output all the banner UI components of the CLI.
 * It's useful to test how they behave under different terminal sizes
 * and to help update the documentation when they change.
 */
export default class Play extends Command {
  static description = 'Play a game to learn about the most recent Shopify Edition'
  static hidden = true

  async run(): Promise<void> {
    const require = createRequire(import.meta.url)
    openURL(require.resolve('@shopify/cli/assets/editions/summer-2024/game.html'))
  }
}
