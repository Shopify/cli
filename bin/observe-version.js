// An optional `v` prefix is kept, because resource names such as alert titles use `(v4.9.3)`.
const VERSION_LITERAL_RE = /(?<![\w.])(v?)((?:\d+|\*)\.(?:\d+|\*)\.(?:\d+|\*))(?![\w.])/g

// Wildcard components in the live value stay wildcards, so `3.*.*` follows only the major version.
export const applyVersion = (existing, version) => {
  const existingParts = existing.split('.')
  // An unexpected shape falls back to the full target version.
  if (existingParts.length !== 3) return version
  const targetParts = version.split('.')
  return existingParts.map((part, index) => (part === '*' ? '*' : targetParts[index])).join('.')
}

export const patchVersionString = (str, version) =>
  typeof str === 'string'
    ? str.replace(VERSION_LITERAL_RE, (match, prefix, existing) => `${prefix}${applyVersion(existing, version)}`)
    : str

export const patchVersionInFilterJson = (jsonString, column, version) => {
  const parsed = JSON.parse(jsonString)
  const patchGroup = (group) => {
    if (group.filters) {
      for (const filter of group.filters) {
        if (filter.column === column && typeof filter.value === 'string') {
          filter.value = applyVersion(filter.value, version)
        }
      }
    }
    if (group.filter_groups) group.filter_groups.forEach(patchGroup)
  }
  patchGroup(parsed)
  return JSON.stringify(parsed)
}
