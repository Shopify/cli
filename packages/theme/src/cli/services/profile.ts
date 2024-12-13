export async function profile(storeUrl: string) {
  // Fetch the profiling from the Store
  const url = new URL(storeUrl)
  url.searchParams.append('profile_liquid', '1')
  const response = await fetch(url)
  const profileJson = await response.text()
  // use process.stdout.write to print the JSON
  process.stdout.write(profileJson)
}
