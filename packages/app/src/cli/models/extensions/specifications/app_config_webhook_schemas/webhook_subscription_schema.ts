import {WebhookSubscriptionUriValidation, removeTrailingSlash} from '../validation/common.js'
import {zod} from '@shopify/cli-kit/node/schema'

export enum ComplianceTopic {
  CustomersRedact = 'customers/redact',
  CustomersDataRequest = 'customers/data_request',
  ShopRedact = 'shop/redact',
}

export const WebhookSubscriptionSchema = zod.object({
  topics: zod
    .array(
      zod.string({
        error: (issue) => {
          if (issue.code === 'invalid_type') {
            return 'Values within array must be a string'
          }
          return issue.message
        },
      }),
      {
        error: (issue) => {
          if (issue.code === 'invalid_type') {
            return 'Value must be string[]'
          }
          return issue.message
        },
      },
    )
    .optional(),
  uri: zod
    .preprocess((arg) => removeTrailingSlash(arg as string), WebhookSubscriptionUriValidation)
    .refine((val) => val !== undefined, {
      message: 'Missing value at',
    }),
  include_fields: zod
    .array(
      zod.string({
        error: (issue) => {
          if (issue.code === 'invalid_type') {
            return 'Value must be a string'
          }
          return issue.message
        },
      }),
    )
    .optional(),
  filter: zod
    .string({
      error: (issue) => {
        if (issue.code === 'invalid_type') {
          return 'Value must be a string'
        }
        return issue.message
      },
    })
    .optional(),
  compliance_topics: zod
    .array(
      zod.enum([ComplianceTopic.CustomersRedact, ComplianceTopic.CustomersDataRequest, ComplianceTopic.ShopRedact]),
      {
        error: (issue) => {
          if (issue.code === 'invalid_type') {
            return 'Value must be an array containing values: customers/redact, customers/data_request or shop/redact'
          }
          return issue.message
        },
      },
    )
    .optional(),
})
