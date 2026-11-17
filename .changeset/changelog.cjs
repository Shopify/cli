// Changelog entries without commit hashes. Changesets' default formatter prefixes each entry with the
// commit that added its changeset. Changesets are written in World, and World commits don't exist on
// the public GitHub repository, so a hash there would point nowhere. The two functions are the
// changelog interface that `changeset version` loads from the `changelog` setting in config.json.

async function getReleaseLine(changeset) {
  const [firstLine, ...otherLines] = changeset.summary.split('\n').map((line) => line.trimEnd())
  const indentedOtherLines = otherLines.map((line) => `\n  ${line}`).join('')
  return `- ${firstLine}${indentedOtherLines}`
}

async function getDependencyReleaseLine(_changesets, dependenciesUpdated) {
  if (dependenciesUpdated.length === 0) return ''
  const updatedDependencies = dependenciesUpdated.map((dependency) => `  - ${dependency.name}@${dependency.newVersion}`)
  return ['- Updated dependencies', ...updatedDependencies].join('\n')
}

module.exports = {getReleaseLine, getDependencyReleaseLine}
