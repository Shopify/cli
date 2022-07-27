import {Service} from '../network/service.js'
import {httpsAgent} from '../http.js'
import {GraphQLClient} from 'graphql-request'

interface GraphqlClientOptions {
  url: string
  service: Service
  headers: {[key: string]: string}
}

/**
 * Creates a GraphQLClient instance with the right HTTPs agent baed on the service
 * the client will interact with.
 */
export async function graphqlClient(options: GraphqlClientOptions) {
  const clientOptions = {agent: await httpsAgent(options.service), headers: options.headers}
  const client = new GraphQLClient(options.url, clientOptions)
  return client
}
