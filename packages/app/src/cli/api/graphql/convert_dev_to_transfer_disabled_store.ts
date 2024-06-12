import {gql} from 'graphql-request'

export const ConvertDevToTransferDisabledStoreQuery = gql`
  mutation convertDevToTestStore($input: ConvertDevToTestStoreInput!) {
    convertDevToTestStore(input: $input) {
      convertedToTestStore
      userErrors {
        message
        field
      }
    }
  }
`

export interface ConvertDevToTransferDisabledStoreVariables {
  input: {
    organizationID: number
    shopId: string
  }
}

export interface ConvertDevToTransferDisabledSchema {
  convertDevToTestStore: {
    convertedToTestStore: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
