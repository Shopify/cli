export async function retry<T>(operation: () => T, retryDelay: number) {
  return new Promise<T>((resolve, _reject) => {
    setTimeout(() => resolve(operation()), retryDelay)
  })
}
