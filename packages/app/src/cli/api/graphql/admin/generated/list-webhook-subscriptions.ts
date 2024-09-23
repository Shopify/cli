/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ListWebhookSubscriptionsQueryVariables = Types.Exact<{[key: string]: never}>

export type ListWebhookSubscriptionsQuery = {
  webhookSubscriptions: {
    edges: {
      node: {
        topic: Types.WebhookSubscriptionTopic
        endpoint:
          | {__typename: 'WebhookEventBridgeEndpoint'}
          | {__typename: 'WebhookHttpEndpoint'; callbackUrl: unknown}
          | {__typename: 'WebhookPubSubEndpoint'}
      }
    }[]
  }
}

export const ListWebhookSubscriptions = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'ListWebhookSubscriptions'},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'webhookSubscriptions'},
            arguments: [
              {kind: 'Argument', name: {kind: 'Name', value: 'first'}, value: {kind: 'IntValue', value: '100'}},
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'edges'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'node'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {kind: 'Field', name: {kind: 'Name', value: 'topic'}},
                            {
                              kind: 'Field',
                              name: {kind: 'Name', value: 'endpoint'},
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                                  {
                                    kind: 'InlineFragment',
                                    typeCondition: {
                                      kind: 'NamedType',
                                      name: {kind: 'Name', value: 'WebhookHttpEndpoint'},
                                    },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {kind: 'Field', name: {kind: 'Name', value: 'callbackUrl'}},
                                        {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                            {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                          ],
                        },
                      },
                      {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                    ],
                  },
                },
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ListWebhookSubscriptionsQuery, ListWebhookSubscriptionsQueryVariables>
