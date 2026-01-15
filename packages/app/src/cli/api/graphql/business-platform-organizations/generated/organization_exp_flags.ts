/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type OrganizationExpFlagsQueryVariables = Types.Exact<{
  organizationId: Types.Scalars['OrganizationID']['input']
  flagHandles: Types.Scalars['String']['input'][] | Types.Scalars['String']['input']
}>

export type OrganizationExpFlagsQuery = {organization?: {id: string; enabledFlags: boolean[]} | null}

export const OrganizationExpFlags = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'OrganizationExpFlags'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'organizationId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'OrganizationID'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'flagHandles'}},
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
            name: {kind: 'Name', value: 'organization'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'organizationId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'organizationId'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'enabledFlags'},
                  arguments: [
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'flagHandles'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'flagHandles'}},
                    },
                  ],
                },
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<OrganizationExpFlagsQuery, OrganizationExpFlagsQueryVariables>
