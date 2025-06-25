import Command from '@shopify/cli-kit/node/base-command'

export default class CopyCommand extends Command {
  static summary = 'Copy a theme to another store.'
  static description = 'This command allows you to copy a theme from one Shopify store to another.'

  async run() {
    console.log('This command is not yet implemented.')
  }
}
