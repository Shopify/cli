import {Shop, Organization} from '../../../apis/destinations/index.js'

export function findShop(shopDomain: string, orgs: Organization[]): Shop | undefined {
  const allShops = orgs.flatMap((org) => org.shops)
  return allShops.find((shop) => shop.domain === shopDomain)
}
