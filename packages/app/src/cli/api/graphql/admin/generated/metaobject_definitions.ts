/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type MetaobjectForImportFragment = {
  type: string
  name: string
  description?: string | null
  displayNameKey?: string | null
  access: {admin: Types.MetaobjectAdminAccess; storefront: Types.MetaobjectStorefrontAccess}
  capabilities: {
    publishable: {enabled: boolean}
    translatable: {enabled: boolean}
    renderable?: {
      enabled: boolean
      data?: {metaTitleKey?: string | null; metaDescriptionKey?: string | null} | null
    } | null
  }
  fieldDefinitions: {
    key: string
    name: string
    description?: string | null
    required: boolean
    type: {category: string; name: string}
    validations: {name: string; value?: string | null}[]
  }[]
}

export type MetaobjectDefinitionsQueryVariables = Types.Exact<{
  after?: Types.InputMaybe<Types.Scalars['String']['input']>
}>

export type MetaobjectDefinitionsQuery = {
  metaobjectDefinitions: {
    pageInfo: {hasNextPage: boolean; endCursor?: string | null}
    nodes: {
      type: string
      name: string
      description?: string | null
      displayNameKey?: string | null
      access: {admin: Types.MetaobjectAdminAccess; storefront: Types.MetaobjectStorefrontAccess}
      capabilities: {
        publishable: {enabled: boolean}
        translatable: {enabled: boolean}
        renderable?: {
          enabled: boolean
          data?: {metaTitleKey?: string | null; metaDescriptionKey?: string | null} | null
        } | null
      }
      fieldDefinitions: {
        key: string
        name: string
        description?: string | null
        required: boolean
        type: {category: string; name: string}
        validations: {name: string; value?: string | null}[]
      }[]
    }[]
  }
}

export const MetaobjectForImportFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: {kind: 'Name', value: 'MetaobjectForImport'},
      typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'MetaobjectDefinition'}},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {kind: 'Field', name: {kind: 'Name', value: 'type'}},
          {kind: 'Field', name: {kind: 'Name', value: 'name'}},
          {kind: 'Field', name: {kind: 'Name', value: 'description'}},
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'access'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'admin'}},
                {kind: 'Field', name: {kind: 'Name', value: 'storefront'}},
              ],
            },
          },
          {kind: 'Field', name: {kind: 'Name', value: 'displayNameKey'}},
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'capabilities'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'publishable'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{kind: 'Field', name: {kind: 'Name', value: 'enabled'}}],
                  },
                },
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'translatable'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{kind: 'Field', name: {kind: 'Name', value: 'enabled'}}],
                  },
                },
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'renderable'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'enabled'}},
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'data'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {kind: 'Field', name: {kind: 'Name', value: 'metaTitleKey'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'metaDescriptionKey'}},
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'fieldDefinitions'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'key'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'type'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'category'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                    ],
                  },
                },
                {kind: 'Field', name: {kind: 'Name', value: 'description'}},
                {kind: 'Field', name: {kind: 'Name', value: 'required'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'validations'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'value'}},
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MetaobjectForImportFragment, unknown>
export const MetaobjectDefinitions = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'metaobjectDefinitions'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'after'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'metaobjectDefinitions'},
            arguments: [
              {kind: 'Argument', name: {kind: 'Name', value: 'first'}, value: {kind: 'IntValue', value: '10'}},
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'after'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'after'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'pageInfo'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'hasNextPage'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'endCursor'}},
                      {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'nodes'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'FragmentSpread', name: {kind: 'Name', value: 'MetaobjectForImport'}},
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
      name: {kind: 'Name', value: 'MetaobjectForImport'},
      typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'MetaobjectDefinition'}},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {kind: 'Field', name: {kind: 'Name', value: 'type'}},
          {kind: 'Field', name: {kind: 'Name', value: 'name'}},
          {kind: 'Field', name: {kind: 'Name', value: 'description'}},
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'access'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'admin'}},
                {kind: 'Field', name: {kind: 'Name', value: 'storefront'}},
              ],
            },
          },
          {kind: 'Field', name: {kind: 'Name', value: 'displayNameKey'}},
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'capabilities'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'publishable'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{kind: 'Field', name: {kind: 'Name', value: 'enabled'}}],
                  },
                },
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'translatable'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{kind: 'Field', name: {kind: 'Name', value: 'enabled'}}],
                  },
                },
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'renderable'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'enabled'}},
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'data'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {kind: 'Field', name: {kind: 'Name', value: 'metaTitleKey'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'metaDescriptionKey'}},
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'fieldDefinitions'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'key'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'type'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'category'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                    ],
                  },
                },
                {kind: 'Field', name: {kind: 'Name', value: 'description'}},
                {kind: 'Field', name: {kind: 'Name', value: 'required'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'validations'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'value'}},
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MetaobjectDefinitionsQuery, MetaobjectDefinitionsQueryVariables>
