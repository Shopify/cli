export interface Organization {
  id: string
  name: string
  shops: Shop[]
}

export interface Shop {
  id: string
  name: string
  webUrl: string
  handle: string
  publicId: string
  shortName: string
  organizationId: string
  domain: string
}

export interface CurrentUserAccountResponse {
  currentUserAccount: {
    organizations: {
      edges: {
        node: {
          name: string
          id: string
          categories: {
            destinations: {
              edges: {
                node: {
                  name: string
                  id: string
                  webUrl: string
                  handle: string
                  publicId: string
                  shortName: string
                  organizationId: string
                }
              }[]
            }
          }[]
        }
      }[]
    }
  }
}
export type OrganizationNode = CurrentUserAccountResponse['currentUserAccount']['organizations']['edges'][0]['node']
export type ShopNode =
  CurrentUserAccountResponse['currentUserAccount']['organizations']['edges'][0]['node']['categories'][0]['destinations']['edges'][0]['node']
