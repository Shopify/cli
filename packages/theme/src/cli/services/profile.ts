import {openURL} from '@shopify/cli-kit/node/system'

export async function profile(storeUrl: String) {
  const profileUrl = storeUrl + '?cache=walrus-no-cache&profile=true&mode=cpu&backend=liquid-vm'

  await openURL(profileUrl)
}
