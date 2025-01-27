export interface FindStoreByDomainSchema {
  organizations: {
    nodes: {
      id: string
      businessName: string
      stores: {
        nodes: {
          shopId: string
          link: string
          shopDomain: string
          shopName: string
          transferDisabled: boolean
          convertableToPartnerTest: boolean
        }[]
      }
    }[]
  }
}
