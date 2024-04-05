import {httpsRegex} from '../../../app/validation/common.js'
import {zod} from '@shopify/cli-kit/node/schema'

// example PubSub URI - pubsub://{project}:{topic}
const pubSubRegex = /^pubsub:\/\/(?<gcp_project_id>[^:]+):(?<gcp_topic>.+)$/
// example Eventbridge ARN - arn:aws:events:{region}::event-source/aws.partner/shopify.com/{app_id}/{path}
const arnRegex =
  /^arn:aws:events:(?<aws_region>[a-z]{2}-[a-z]+-[0-9]+)::event-source\/aws\.partner\/shopify\.com(\.test)?\/(?<api_client_id>\d+)\/(?<event_source_name>.+)$/

export const removeTrailingSlash = (arg: unknown) =>
  typeof arg === 'string' && arg.endsWith('/') ? arg.replace(/\/+$/, '') : arg

export const UriValidation = zod.union(
  [
    zod.string({invalid_type_error: 'Value must be string'}).regex(httpsRegex, {
      message: "URI isn't correct URI format of https://, pubsub://{project}:topic or Eventbridge ARN",
    }),
    zod.string({invalid_type_error: 'Value must be string'}).regex(pubSubRegex, {
      message: "URI isn't correct URI format of https://, pubsub://{project}:topic or Eventbridge ARN",
    }),
    zod.string({invalid_type_error: 'Value must be string'}).regex(arnRegex, {
      message: "URI isn't correct URI format of https://, pubsub://{project}:topic or Eventbridge ARN",
    }),
  ],
  {invalid_type_error: 'Invalid URI format'},
)
