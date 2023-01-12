import {system} from '@shopify/cli-kit'

export async function searchService(query: string) {
  const searchParams = new URLSearchParams()
  searchParams.append('search', query)
  await system.open(`https://shopify.dev?${searchParams.toString()}`)
}
