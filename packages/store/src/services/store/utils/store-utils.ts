import {Shop, Organization} from '../../../apis/destinations/types.js'
import {fetchOrgs} from '../../../apis/destinations/index.js'

export async function fetchOrganizations(bpSession: string): Promise<Organization[]> {
  return (await fetchOrgs(bpSession)).filter((org) => org.shops.length > 1)
}

export function findShop(shopDomain: string, orgs: Organization[]): Shop | undefined {
  const allShops = orgs.flatMap((org) => org.shops)
  return allShops.find((shop) => shop.domain === shopDomain)
}
