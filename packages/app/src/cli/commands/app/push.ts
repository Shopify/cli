import {Command} from '@oclif/core'
import {api} from '@shopify/cli-kit'
import {apiVersionQuery} from '@shopify/cli-kit/src/api/admin-api'
import {gql} from 'graphql-request'

export default class Push extends Command {
  static description = 'Push an app to Shopify'

  async run(): Promise<void> {
    console.log('WORKS')

    const token = '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'
    // const store = 'https://isaacroldan.myshopify.com'

    const query = gql`
      query {
        publicApiVersions {
          handle
          supported
          aaaaa
        }
      }
    `

    try {
      const version = await api.adminAPI.query<any>(
        query,
        {accessToken: token, expiresAt: new Date(), scopes: []},
        'isaacroldan.myshopify.com',
        undefined,
      )
      console.log(`LATEST VERSION -> ${version}`)
    } catch (error) {
      console.log('MY ERROR')
      console.log(error)
      throw error
    }

    console.log(version)
  }
}
