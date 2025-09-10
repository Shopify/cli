/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type OrganizationBetaFlagsQueryVariables = Types.Exact<{
  organizationId: Types.Scalars['OrganizationID']['input']
  flags: Types.Scalars['String']['input'][] | Types.Scalars['String']['input']
}>

export type OrganizationBetaFlagsQuery = {
  currentUserAccount?: {organization?: {id: string; name: string; enabledFlags: boolean[]} | null} | null
}

export const OrganizationBetaFlags = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'OrganizationBetaFlags'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'organizationId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'OrganizationID'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'flags'}},
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'currentUserAccount'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'organization'},
                  arguments: [
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'id'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'organizationId'}},
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'enabledFlags'},
                        arguments: [
                          {
                            kind: 'Argument',
                            name: {kind: 'Name', value: 'flagHandles'},
                            value: {kind: 'Variable', name: {kind: 'Name', value: 'flags'}},
                          },
                        ],
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
} as unknown as DocumentNode<OrganizationBetaFlagsQuery, OrganizationBetaFlagsQueryVariables>
