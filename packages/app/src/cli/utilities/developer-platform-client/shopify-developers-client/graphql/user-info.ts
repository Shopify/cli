import {gql} from 'graphql-request'

export const UserInfoQuery = gql`
  query UserInfo {
    currentUserAccount {
      uuid
      email
    }
  }
`

export interface UserInfoQuerySchema {
  currentUserAccount: {
    uuid: string
    email: string
  }
}
