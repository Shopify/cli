/** Plain JS string ordering (code unit order), deliberately not locale-aware so results are deterministic. */
export function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  return left > right ? 1 : 0
}
