export function removeDuplicates<T>(arr: T[], cb: (v: T, index: number, obj: T[]) => unknown): T[] {
  return arr.filter(
    (value, index, all) =>
      index === arr.findIndex((...args) => cb(...args) === cb(value, index, all)),
  );
}
