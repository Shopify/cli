/**
 * Deep sets an object in a type-safe way
 */
export function set<TObject extends object, TValue>(
  obj: TObject,
  pathFn: (o: TObject) => TValue,
  value: TValue,
): TObject {
  const path: string[] = []
  const proxy: unknown = new Proxy(
    {},
    {
      get: (_, prop: string) => {
        path.push(prop)
        return proxy
      },
    },
  )
  pathFn(proxy as TObject)

  const newObj = {...obj}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = newObj

  const lastKey = path.pop()!

  for (const key of path) {
    current[key] = {...current[key]}
    current = current[key]
  }

  current[lastKey] = value

  return newObj
}
