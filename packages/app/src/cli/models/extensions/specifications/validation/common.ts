import {httpsRegex} from '../../../app/validation/common.js'
import {zod} from '@shopify/cli-kit/node/schema'

// example PubSub URI - pubsub://{project}:{topic}
const pubSubRegex = /^pubsub:\/\/(?<gcp_project_id>[^:]+):(?<gcp_topic>.+)$/
// example Eventbridge ARN - arn:aws:events:{region}::event-source/aws.partner/shopify.com/{app_id}/{path}
const arnRegex =
  /^arn:aws:events:(?<aws_region>[a-z]{2}-[a-z]+-[0-9]+)::event-source\/aws\.partner\/shopify\.com(\.test)?\/(?<api_client_id>\d+)\/(?<event_source_name>.+)$/

export const removeTrailingSlash = (arg: unknown) =>
  typeof arg === 'string' && arg.endsWith('/') ? arg.replace(/\/+$/, '') : arg

export const UriValidation = zod.string({invalid_type_error: 'Value must be string'}).refine(
  (uri) => {
    if (uri.startsWith('/')) return true

    return httpsRegex.test(uri) || pubSubRegex.test(uri) || arnRegex.test(uri)
  },
  {
    message: "URI isn't correct URI format of https://, pubsub://{project-id}:{topic-id} or Eventbridge ARN",
  },
)
