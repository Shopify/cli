import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {matchesGlob, resolve} from 'node:path'
import {execFileSync} from 'node:child_process'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {encoding: 'utf8'}).trim()
const read = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'))
// Frozen effective configurations were captured from the original revision
// before removing ESLint. Auditing the migration must not reinstall its engine.
const baseline = read('configurations/oxlint-baseline.json')
const mapping = read('configurations/oxlint-rule-mapping.json')
const config = read('oxlint.json')
const scripts = read('package.json').scripts
const formattingInputs = [...scripts.prettier.matchAll(/"([^"]+)"/g)].map((match) => match[1])
const match = (file, patterns) => patterns?.some((pattern) => matchesGlob(file, pattern))
const severity = (value) => {
  const level = Array.isArray(value) ? value[0] : value
  return {off: 0, allow: 0, warn: 1, error: 2, deny: 2}[level] ?? level
}

const stable = (value) => JSON.stringify(value, (_, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([first], [second]) => first.localeCompare(second))) : item)

const missing = new Map()
const options = new Set()
const severities = new Set()
const unsupported = new Set()
const supported = new Set()
const partial = new Set()
const missingFormatting = []
let filesCompared = 0
const retiredFiles = []
for (const group of baseline.configurations) {
  const before = {...baseline.rules, ...group.rules}
  for (const name of group.removed) delete before[name]
  for (const file of group.files) {
    if (!existsSync(resolve(root, file))) {
      retiredFiles.push(file)
      continue
    }
    const after = {...config.rules}
    for (const override of config.overrides) {
      if (match(file, override.files) && !match(file, override.excludeFiles)) Object.assign(after, override.rules)
    }
    // Preserve file-wide exemptions while comparing effective file scopes.
    const header = readFileSync(resolve(root, file), 'utf8').match(/^(?:\s*(?:\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/))*/)?.[0] ?? ''
    for (const directive of header.matchAll(/eslint-disable(?!-)([^\n*]*)/g)) {
      for (const name of directive[1].split(' -- ')[0].split(',').map((name) => name.trim())) delete after[name]
    }
    if (!match(file, formattingInputs)) missingFormatting.push(file)
    for (const [name, value] of Object.entries(before)) {
      const replacement = mapping[name]
      if (!replacement) throw new Error(`Undocumented original rule: ${name}`)
      if (replacement.status === 'unsupported') {
        unsupported.add(name)
        continue
      }
      if (severity(after[replacement.replacement] ?? 'off') === 0) {
        const examples = missing.get(name) ?? []
        if (examples.length < 4) examples.push(file)
        missing.set(name, examples)
        continue
      }
      supported.add(name)
      if (replacement.status === 'partial') partial.add(name)
      if (severity(value) !== severity(after[replacement.replacement])) severities.add(name)
      const parameters = (configuration) => Array.isArray(configuration) ? configuration.slice(1) : []
      if (stable(parameters(value)) !== stable(parameters(after[replacement.replacement]))) options.add(name)
    }
    filesCompared++
  }
}

const summary = {
  baselineCommit: baseline.baselineCommit,
  filesCompared,
  retiredFiles: retiredFiles.length,
  baselineLintRules: Object.keys(mapping).length,
  rulesWithReplacements: supported.size,
  partialReplacements: partial.size,
  unsupportedRules: unsupported.size,
  rulesWithScopeGaps: missing.size,
  optionDifferences: options.size,
  severityDifferences: severities.size,
  missingFormattingFiles: missingFormatting.length,
}
const findings = {
  scopeGaps: Object.fromEntries(missing),
  optionDifferences: [...options].sort(),
  severityDifferences: [...severities].sort(),
  unsupportedRules: [...unsupported].sort(),
  partialReplacements: [...partial].sort(),
  missingFormatting,
}
const output = process.argv[2] ?? '/tmp/cli-oxlint-coverage-audit.json'
writeFileSync(output, JSON.stringify({summary, findings}, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
// Partial and unsupported replacements are deliberate and recorded in the
// mapping. Missing file scopes or formatting must be fixed or documented there.
if (missing.size || missingFormatting.length || severities.size) process.exitCode = 1
