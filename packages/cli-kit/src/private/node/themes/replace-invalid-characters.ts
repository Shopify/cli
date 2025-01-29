export function replaceInvalidCharacters(identifier: string) {
  // gu: global, and enable unicode support
  const regex = /[^\p{Letter}\p{Number}\p{Mark}-]/gu
  return identifier.replace(regex, '-')
}
