/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type CreateAppVersionMutationVariables = Types.Exact<{
  appId: Types.Scalars['ID']['input']
  version: Types.AppVersionInput
  metadata?: Types.InputMaybe<Types.VersionMetadataInput>
}>

export type CreateAppVersionMutation = {
  appVersionCreate: {
    version?: {
      id: string
      appModules: {
        uuid: string
        userIdentifier: string
        handle: string
        config: JsonMapType
        specification: {identifier: string; externalIdentifier: string; name: string}
      }[]
      metadata: {versionTag?: string | null; message?: string | null}
    } | null
    userErrors: {
      field?: string[] | null
      message: string
      category: string
      code?: Types.Code | null
      on: JsonMapType
    }[]
  }
}

export const CreateAppVersion = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'CreateAppVersion'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'version'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'AppVersionInput'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'metadata'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'VersionMetadataInput'}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'appVersionCreate'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'appId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'version'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'version'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'metadata'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'metadata'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'version'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'appModules'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {kind: 'FragmentSpread', name: {kind: 'Name', value: 'ReleasedAppModule'}},
                            {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'metadata'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {kind: 'Field', name: {kind: 'Name', value: 'versionTag'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'message'}},
                            {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                          ],
                        },
                      },
                      {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'userErrors'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'field'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'message'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'category'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'code'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'on'}},
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
    {
      kind: 'FragmentDefinition',
      name: {kind: 'Name', value: 'ReleasedAppModule'},
      typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'AppModule'}},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {kind: 'Field', name: {kind: 'Name', value: 'uuid'}},
          {kind: 'Field', name: {kind: 'Name', value: 'userIdentifier'}},
          {kind: 'Field', name: {kind: 'Name', value: 'handle'}},
          {kind: 'Field', name: {kind: 'Name', value: 'config'}},
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'specification'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'identifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'externalIdentifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CreateAppVersionMutation, CreateAppVersionMutationVariables>
