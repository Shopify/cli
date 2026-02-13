export function unionArrayStrategy(destinationArray: unknown[], sourceArray: unknown[]): unknown[] {
  return Array.from(new Set([...destinationArray, ...sourceArray]))
}
