import {Command} from '@oclif/core'
import {ruby, session} from '@shopify/cli-kit'

export default class Pull extends Command {
  static description = 'Download your remote theme files locally.'

  async run(): Promise<void> {
    const adminSession = await session.ensureAuthenticatedAdmin('isaacroldan')
    await ruby.exec(['theme', 'pull'], adminSession.token)
  }
}
