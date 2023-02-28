export function replaceInvalidCharacters(identifier: string) {
  const findAllMatches = 'g'
  const enablesUnicodeSupport = 'u'
  return identifier.replace(
    new RegExp(/[^\p{Letter}\p{Number}\p{Mark}-]/, `${findAllMatches}${enablesUnicodeSupport}`),
    '-',
  )
}
