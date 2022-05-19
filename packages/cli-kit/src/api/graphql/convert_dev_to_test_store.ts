import {gql} from 'graphql-request'

export const ConvertDevToTestStoreQuery = gql`
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

export interface ConvertDevToTestStoreVariables {
  input: {
    organizationID: number
    shopId: string
  }
}

export interface ConvertDevToTestStoreSchema {
  convertDevToTestStore: {
    convertedToTestStore: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
