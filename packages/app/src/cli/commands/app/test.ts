import {Command} from '@oclif/core'

export default class Test extends Command {
  static description = 'Run the tests for a given block or app'
  async run(): Promise<void> {}
}
