import {gql} from 'graphql-request'

export const DevSessionDeleteMutation = gql`
  mutation devSessionDelete($id: ID!) {
    devSessionDelete(id: $id) {
      deletedAppId
    }
  }
`

export interface DevSessionDeleteVariables {
  id: string
}

export interface DevSessionDeleteSchema {
  devSessionDelete: {
    deletedAppId: string
  }
}
