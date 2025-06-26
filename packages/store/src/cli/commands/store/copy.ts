import Command from '@shopify/cli-kit/node/base-command'

export default class CopyCommand extends Command {
  static summary = 'Copy data to another store.'
  static description = 'This command allows you to copy data from one Shopify store to another.'

  async run() {
    console.log('This command is not yet implemented.')
  }
}
