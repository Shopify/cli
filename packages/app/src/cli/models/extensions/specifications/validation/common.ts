import {zod} from '@shopify/cli-kit/node/schema'

const httpsRegex = /^(https:\/\/)/
// example PubSub URI - pubsub://{project}:{topic}
const pubSubRegex = /^pubsub:\/\/(?<gcp_project_id>[^:]+):(?<gcp_topic>.+)$/
// example Eventbridge ARN - arn:aws:events:{region}::event-source/aws.partner/shopify.com/{app_id}/{path}
const arnRegex =
  /^arn:aws:events:(?<aws_region>[a-z]{2}-[a-z]+-[0-9]+)::event-source\/aws\.partner\/shopify\.com(\.test)?\/(?<api_client_id>\d+)\/(?<event_source_name>.+)$/

export function removeTrailingSlash(arg: string): string
export function removeTrailingSlash(arg: unknown): unknown {
  return typeof arg === 'string' && arg.endsWith('/') ? arg.replace(/\/+$/, '') : arg
}

export const WebhookSubscriptionUriValidation = zod.string({invalid_type_error: 'Value must be string'}).refine(
  (uri) => {
    if (uri.startsWith('/')) return true

    return httpsRegex.test(uri) || pubSubRegex.test(uri) || arnRegex.test(uri)
  },
  {
    message:
      "URI format isn't correct. Valid formats include: relative path starting with a slash, HTTPS URL, pubsub://{project-id}:{topic-id} or Eventbridge ARN",
  },
)
