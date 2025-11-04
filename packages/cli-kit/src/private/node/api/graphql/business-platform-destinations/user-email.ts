// UserEmail query for fetching user email from Business Platform API
export interface UserEmailQuery {
  currentUserAccount?: {
    email: string
  } | null
}

export const UserEmailQueryString = `
  query UserEmail {
    currentUserAccount {
      email
    }
  }
`
