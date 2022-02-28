import {Command} from '@oclif/core'
import {api} from '@shopify/cli-kit'
// import {fetchApiVersion} from '@shopify/cli-kit/src/api/admin-api'

export default class Test extends Command {
  static description = 'Run the tests for a given block or app'
  async run(): Promise<void> {
    console.log('WORKS')

    const token = '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'
    const store = 'https://isaacroldan.myshopify.com'
    const version = await api.adminAPI.fetchApiVersion(token, store)
    console.log(`LATEST VERSION -> ${version}`)
  }
}
