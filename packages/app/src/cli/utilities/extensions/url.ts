export const isValidUrl = (urlString: string) => {
  try {
    return Boolean(new URL(urlString))
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return false
  }
}
