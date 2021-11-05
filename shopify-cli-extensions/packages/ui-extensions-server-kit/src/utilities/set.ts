/**
 * Deep sets an object in a type-safe way
 */
export function set<T, V>(obj: T, pathFn: (o: T) => V, value: V) {
  const path: string[] = [];
  const proxy: any = new Proxy(
    {},
    {
      get: (_, prop: string) => {
        path.push(prop);
        return proxy;
      },
    },
  );
  pathFn(proxy);

  const newObj: T = {...obj};
  let current: any = newObj;
  const lastKey = path.pop()!;

  for (const key of path) {
    current[key] = {...current[key]};
    current = current[key];
  }

  current[lastKey] = value;

  return newObj;
}
