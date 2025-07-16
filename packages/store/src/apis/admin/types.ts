/* eslint-disable @typescript-eslint/consistent-type-definitions */

import {StagedUploadsCreate} from '../../cli/api/graphql/admin/generated/staged_uploads_create.js'
import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export interface Shop {
  id: string
  name: string
}
export type SQLiteStagedUploadInput = {
  filename: string
  mimeType: 'application/x-sqlite3'
  httpMethod: 'POST'
  fileSize?: string
  resource: 'SQLITE_DATABASE'
}
export type SQLiteStagedUploadsCreateMutationVariables = {
  input: SQLiteStagedUploadInput[]
}

export type SQLiteStagedUploadsCreateMutation = {
  stagedUploadsCreate?: {
    stagedTargets?:
      | {
          url?: string | null
          resourceUrl?: string | null
          parameters: {name: string; value: string}[]
        }[]
      | null
    userErrors: {field?: string[] | null; message: string}[]
  } | null
}

export const SQLiteStagedUploadsCreate = {
  ...StagedUploadsCreate,
  definitions: [
    {
      ...StagedUploadsCreate.definitions[0],
      name: {kind: 'Name', value: 'SQLiteStagedUploadsCreate'},
    },
  ],
} as unknown as DocumentNode<SQLiteStagedUploadsCreateMutation, SQLiteStagedUploadsCreateMutationVariables>
