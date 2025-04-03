/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents */
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import * as Types from './types';

import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type AvailableTopicsQueryVariables = Types.Exact<{
  apiVersion: Types.Scalars['String']['input'];
}>;


export type AvailableTopicsQuery = { availableTopics?: Array<string> | null };


export const AvailableTopicsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"availableTopics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"apiVersion"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"availableTopics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"apiVersion"},"value":{"kind":"Variable","name":{"kind":"Name","value":"apiVersion"}}}]}]}}]} as unknown as DocumentNode<AvailableTopicsQuery, AvailableTopicsQueryVariables>;