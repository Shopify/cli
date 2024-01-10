import {httpsRegex, validateUrl} from '../../../app/validation/common.js'
import {zod} from '@shopify/cli-kit/node/schema'

// example PubSub URI - pubsub://{project}:{topic}
const pubSubRegex = /^pubsub:\/\/(?<gcp_project_id>[^:]+):(?<gcp_topic>.+)$/
// example Eventbridge ARN - arn:aws:events:{region}::event-source/aws.partner/shopify.com/{app_id}/{path}
const arnRegex =
  /^arn:aws:events:(?<aws_region>[a-z]{2}-[a-z]+-[0-9]+)::event-source\/aws\.partner\/shopify\.com(\.test)?\/(?<api_client_id>\d+)\/(?<event_source_name>.+)$/

export const removeTrailingSlash = (arg: unknown) =>
  typeof arg === 'string' && arg.endsWith('/') ? arg.replace(/\/+$/, '') : arg

export const ensureHttpsOnlyUrl = validateUrl(zod.string(), {
  httpsOnly: true,
  message: 'Only https urls are allowed',
}).refine((url) => !url.endsWith('/'), {message: 'URL can’t end with a forward slash'})

export const UriValidation = zod.union([
  zod.string().regex(httpsRegex),
  zod.string().regex(pubSubRegex),
  zod.string().regex(arnRegex),
])
