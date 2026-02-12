import {openURL} from '@shopify/cli-kit/shared/node/system'

export async function searchService(query?: string) {
  const searchParams = new URLSearchParams()
  searchParams.append('search', query ?? '')
  await openURL(`https://shopify.dev?${searchParams.toString()}`)
}
