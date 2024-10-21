/**
 * Deep sets an object in a type-safe way
 */
export function set<TObject, TValue>(obj: TObject, pathFn: (o: TObject) => TValue, value: TValue) {
  const path: string[] = []
  const proxy: any = new Proxy(
    {},
    {
      get: (_, prop: string) => {
        path.push(prop)
        return proxy
      },
    },
  )
  pathFn(proxy)

  const newObj: TObject = {...obj}
  let current: any = newObj
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const lastKey = path.pop()!

  for (const key of path) {
    current[key] = {...current[key]}
    current = current[key]
  }

  current[lastKey] = value

  return newObj
}
