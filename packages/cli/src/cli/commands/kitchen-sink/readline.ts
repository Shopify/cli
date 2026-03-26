import {readlineConcurrent} from '../../services/kitchen-sink/readline.js'
import Command from '@shopify/cli-kit/node/base-command'

/**
 * This command is used to demo the readline-based ConcurrentOutput component.
 * It renders the same concurrent process output as `kitchen-sink async` but
 * without Ink/React — only Node's built-in readline module.
 */
export default class KitchenSinkReadline extends Command {
  static description = 'View the readline-based concurrent output component'
  static hidden = true

  async run(): Promise<void> {
    await readlineConcurrent()
  }
}
