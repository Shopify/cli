/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents */
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import * as Types from './types';

import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type DevSessionCreateMutationVariables = Types.Exact<{
  appId: Types.Scalars['String']['input'];
  assetsUrl: Types.Scalars['String']['input'];
}>;


export type DevSessionCreateMutation = { devSessionCreate?: { userErrors: Array<{ message: string, on: JsonMapType, field?: Array<string> | null, category: string }> } | null };


export const DevSessionCreateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DevSessionCreate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"appId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetsUrl"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"devSessionCreate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"appId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"appId"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetsUrl"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetsUrl"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"on"}},{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"__typename"}}]}},{"kind":"Field","name":{"kind":"Name","value":"__typename"}}]}}]}}]} as unknown as DocumentNode<DevSessionCreateMutation, DevSessionCreateMutationVariables>;