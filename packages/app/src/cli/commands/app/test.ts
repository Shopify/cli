import {Command} from '@oclif/core'
import {api} from '@shopify/cli-kit'
// import {fetchApiVersion} from '@shopify/cli-kit/src/api/admin-api'
import {gql} from 'graphql-request'

export default class Test extends Command {
  static description = 'Run the tests for a given block or app'
  async run(): Promise<void> {}
}
