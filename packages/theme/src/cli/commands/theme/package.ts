import {Command} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class Package extends Command {
  static description = 'Package a theme to manually upload it to the Online Store.'

  async run(): Promise<void> {
    await ruby.exec(['theme', 'package'], '')
  }
}
