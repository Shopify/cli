#!/usr/bin/env node
// Prints the GitHub release notes for a version from the packages' changelogs: each entry once,
// grouped by area under "What's Changed", the layout bin/create-notification-pr.js reads.
// Usage: node .github/scripts/release-notes.js <version>
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {join} from 'node:path'

const version = process.argv[2]
if (!version) {
  console.error('Usage: node .github/scripts/release-notes.js <version>')
  process.exit(1)
}

// An entry that several packages list goes under the first of these areas that lists it.
const areaOfPackage = {app: 'App', store: 'Store', theme: 'Theme'}
const areas = ['App', 'Store', 'Theme', 'CLI']
// Stable lines keep changesets' default formatter, which starts each entry with a commit hash.
const commitPrefix = /^[0-9a-f]{7}: /

function changelogEntries(changelog) {
  const lines = changelog.split('\n')
  const start = lines.indexOf(`## ${version}`)
  if (start === -1) return []
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '))
  const entries = []
  let entry
  for (const line of lines.slice(start + 1, end === -1 ? undefined : end)) {
    if (line.startsWith('- ')) {
      entry = [line]
      entries.push(entry)
    } else if (line.startsWith('#')) {
      entry = undefined
    } else if (entry && (line.startsWith('  ') || line.trim() === '')) {
      // An entry's own blank lines matter inside its code blocks and lists.
      entry.push(line)
    }
  }
  return entries
    .filter(([firstLine]) => !firstLine.startsWith('- Updated dependencies'))
    .map(([firstLine, ...otherLines]) => {
      const text = [`* ${firstLine.slice(2).replace(commitPrefix, '')}`, ...otherLines].join('\n')
      return text.trimEnd()
    })
}

const packageDirectories = readdirSync('packages').sort((a, b) => {
  const areaIndex = (directory) => areas.indexOf(areaOfPackage[directory] ?? 'CLI')
  return areaIndex(a) - areaIndex(b) || a.localeCompare(b)
})
const entriesByArea = new Map(areas.map((area) => [area, []]))
const seen = new Set()
for (const directory of packageDirectories) {
  const changelogPath = join('packages', directory, 'CHANGELOG.md')
  if (!existsSync(changelogPath)) continue
  for (const entry of changelogEntries(readFileSync(changelogPath, 'utf8'))) {
    if (seen.has(entry)) continue
    seen.add(entry)
    entriesByArea.get(areaOfPackage[directory] ?? 'CLI').push(entry)
  }
}

if (seen.size === 0) {
  console.error(`No changelog entries for ${version}`)
  process.exit(1)
}

const sections = areas
  .filter((area) => entriesByArea.get(area).length > 0)
  .map((area) => [`### ${area}`, ...entriesByArea.get(area)].join('\n'))
console.log(["## What's Changed", ...sections].join('\n\n'))
