/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type AppVersionByTagQueryVariables = Types.Exact<{
  versionTag: Types.Scalars['String']['input']
}>

export type AppVersionByTagQuery = {
  versionByTag: {
    id: string
    metadata: {message?: string | null; versionTag?: string | null}
    appModules: {
      id: number
      uuid: string
      userIdentifier: string
      handle: string
      config: JsonMapType
      target?: string | null
      specification: {identifier: string; externalIdentifier: string; name: string; managementExperience: string}
    }[]
  }
}

export const AppVersionByTag = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'AppVersionByTag'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'versionTag'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'versionByTag'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'tag'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'versionTag'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'FragmentSpread', name: {kind: 'Name', value: 'VersionInfo'}},
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
          {kind: 'Field', name: {kind: 'Name', value: 'id'}},
          {kind: 'Field', name: {kind: 'Name', value: 'uuid'}},
          {kind: 'Field', name: {kind: 'Name', value: 'userIdentifier'}},
          {kind: 'Field', name: {kind: 'Name', value: 'handle'}},
          {kind: 'Field', name: {kind: 'Name', value: 'config'}},
          {kind: 'Field', name: {kind: 'Name', value: 'target'}},
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'specification'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'identifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'externalIdentifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                {kind: 'Field', name: {kind: 'Name', value: 'managementExperience'}},
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: {kind: 'Name', value: 'VersionInfo'},
      typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'Version'}},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {kind: 'Field', name: {kind: 'Name', value: 'id'}},
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'metadata'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'message'}},
                {kind: 'Field', name: {kind: 'Name', value: 'versionTag'}},
              ],
            },
          },
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'appModules'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{kind: 'FragmentSpread', name: {kind: 'Name', value: 'ReleasedAppModule'}}],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AppVersionByTagQuery, AppVersionByTagQueryVariables>
