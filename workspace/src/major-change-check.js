#!/usr/bin/env node

/**
 * Detects potential breaking changes in a PR by checking:
 *
 * 1. Changesets requesting a major version bump
 * 2. OCLIF manifest changes: removed commands, removed flags, or removed flag env vars
 * 3. Zod schema changes: removed or renamed fields in app/extension config schemas
 *
 * Compares the current branch against the main branch baseline.
 * Outputs a GitHub Actions summary and sets a `has_breaking_changes` output.
 */

import * as path from 'pathe'
import * as url from 'url'
import {mkdtemp, rm} from 'fs/promises'
import os from 'os'
import {promises as fs} from 'fs'
import {setOutput} from '@actions/core'
import {cloneCLIRepository} from './utils/git.js'
import {logMessage, logSection} from './utils/log.js'
import fg from 'fast-glob'

const currentDirectory = path.join(url.fileURLToPath(new URL('.', import.meta.url)), '../..')

// ---------------------------------------------------------------------------
// 1. Check changesets for major bumps
// ---------------------------------------------------------------------------

async function checkChangesets() {
  logSection('Checking changesets for major bumps')

  const changesetFiles = await fg('.changeset/*.md', {
    cwd: currentDirectory,
    absolute: true,
    ignore: ['**/README.md'],
  })

  const majorChangesets = []

  for (const file of changesetFiles) {
    const content = (await fs.readFile(file, 'utf-8')).trim()
    // Changeset format: YAML frontmatter between --- markers, with 'package: major'
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) continue

    const frontmatter = frontmatterMatch[1]
    const lines = frontmatter.split('\n')

    for (const line of lines) {
      if (line.match(/:\s*major\s*$/)) {
        majorChangesets.push({
          file: path.basename(file),
          line: line.trim(),
        })
      }
    }
  }

  if (majorChangesets.length > 0) {
    logMessage(`Found ${majorChangesets.length} changeset(s) with major bump`)
    for (const cs of majorChangesets) {
      logMessage(`  ${cs.file}: ${cs.line}`)
    }
  } else {
    logMessage('No major changesets found')
  }

  return majorChangesets
}

// ---------------------------------------------------------------------------
// 2. Check OCLIF manifest for removed commands, flags, or flag env vars
// ---------------------------------------------------------------------------

async function parseManifest(directory) {
  const manifestPath = path.join(directory, 'packages/cli/oclif.manifest.json')
  try {
    const content = await fs.readFile(manifestPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

function extractManifestSurface(manifest) {
  const surface = {commands: {}, envVars: {}}
  if (!manifest?.commands) return surface

  for (const [cmdName, cmd] of Object.entries(manifest.commands)) {
    const flags = {}
    if (cmd.flags) {
      for (const [flagName, flag] of Object.entries(cmd.flags)) {
        flags[flagName] = {
          type: flag.type,
          env: flag.env || null,
        }
        if (flag.env) {
          surface.envVars[flag.env] = surface.envVars[flag.env] || []
          surface.envVars[flag.env].push({command: cmdName, flag: flagName})
        }
      }
    }
    surface.commands[cmdName] = {flags}
  }

  return surface
}

async function checkManifest(baselineDirectory) {
  logSection('Checking OCLIF manifest for removed commands/flags')

  const baselineManifest = await parseManifest(baselineDirectory)
  const currentManifest = await parseManifest(currentDirectory)

  if (!baselineManifest || !currentManifest) {
    logMessage('Could not read one or both manifests, skipping')
    return {removedCommands: [], removedFlags: [], removedEnvVars: []}
  }

  const baseline = extractManifestSurface(baselineManifest)
  const current = extractManifestSurface(currentManifest)

  // Removed commands
  const removedCommands = Object.keys(baseline.commands).filter(
    (cmd) => !current.commands[cmd],
  )

  // Removed flags (in commands that still exist)
  const removedFlags = []
  for (const [cmdName, cmd] of Object.entries(baseline.commands)) {
    if (!current.commands[cmdName]) continue
    for (const flagName of Object.keys(cmd.flags)) {
      if (!current.commands[cmdName].flags[flagName]) {
        removedFlags.push({command: cmdName, flag: flagName})
      }
    }
  }

  // Removed env vars
  const removedEnvVars = []
  for (const [envVar, usages] of Object.entries(baseline.envVars)) {
    if (!current.envVars[envVar]) {
      removedEnvVars.push({envVar, usages})
    }
  }

  if (removedCommands.length > 0) {
    logMessage(`Removed commands: ${removedCommands.join(', ')}`)
  }
  if (removedFlags.length > 0) {
    logMessage(`Removed flags: ${removedFlags.map((f) => `${f.command} --${f.flag}`).join(', ')}`)
  }
  if (removedEnvVars.length > 0) {
    logMessage(`Removed env vars: ${removedEnvVars.map((e) => e.envVar).join(', ')}`)
  }
  if (removedCommands.length === 0 && removedFlags.length === 0 && removedEnvVars.length === 0) {
    logMessage('No removed commands, flags, or env vars')
  }

  return {removedCommands, removedFlags, removedEnvVars}
}

// ---------------------------------------------------------------------------
// 3. Check Zod schemas for removed/renamed fields
// ---------------------------------------------------------------------------

/**
 * Extracts a simplified map of schema field names from Zod schema source files.
 * Looks for patterns like: `fieldName: zod.` or `field_name: zod.` in .object({...}) blocks.
 * This is an intentionally conservative heuristic — AST parsing would be heavier.
 */
function extractSchemaFields(content) {
  const fields = new Set()

  // Match zod.object({ ... }) blocks and extract field names
  // Handles multi-line objects
  const objectBlockRegex = /\.object\(\s*\{([\s\S]*?)\}\s*\)/g
  let match

  while ((match = objectBlockRegex.exec(content)) !== null) {
    const block = match[1]
    // Extract field names: word characters (including underscore) before a colon
    const fieldRegex = /^\s*(\w+)\s*:/gm
    let fieldMatch
    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      fields.add(fieldMatch[1])
    }
  }

  return fields
}

async function checkSchemas(baselineDirectory) {
  logSection('Checking Zod schemas for removed fields')

  const schemaGlob = 'packages/app/src/cli/models/**/specifications/**/*.ts'
  const appModelGlob = 'packages/app/src/cli/models/app/app.ts'
  const ignorePatterns = ['**/*.test.ts', '**/*.test-data.ts']

  const currentSchemaFiles = await fg([schemaGlob, appModelGlob], {
    cwd: currentDirectory,
    ignore: ignorePatterns,
  })
  const baselineSchemaFiles = await fg([schemaGlob, appModelGlob], {
    cwd: baselineDirectory,
    ignore: ignorePatterns,
  })

  const removedFields = []

  for (const file of baselineSchemaFiles) {
    const baselinePath = path.join(baselineDirectory, file)
    const currentPath = path.join(currentDirectory, file)

    let baselineContent
    let currentContent
    try {
      baselineContent = await fs.readFile(baselinePath, 'utf-8')
    } catch {
      continue
    }
    try {
      currentContent = await fs.readFile(currentPath, 'utf-8')
    } catch {
      // File was deleted — all fields are removed
      const fields = extractSchemaFields(baselineContent)
      if (fields.size > 0) {
        removedFields.push({file, fields: [...fields], type: 'file_deleted'})
      }
      continue
    }

    // Only check files that actually contain zod schemas
    if (!baselineContent.includes('zod.object(') && !baselineContent.includes('.object(')) continue

    const baselineFields = extractSchemaFields(baselineContent)
    const currentFields = extractSchemaFields(currentContent)

    const removed = [...baselineFields].filter((f) => !currentFields.has(f))
    if (removed.length > 0) {
      removedFields.push({file, fields: removed, type: 'fields_removed'})
    }
  }

  if (removedFields.length > 0) {
    for (const entry of removedFields) {
      logMessage(`${entry.file}: removed fields [${entry.fields.join(', ')}] (${entry.type})`)
    }
  } else {
    logMessage('No removed schema fields detected')
  }

  return removedFields
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function buildReport({majorChangesets, manifestChanges, schemaChanges}) {
  const hasBreaking =
    majorChangesets.length > 0 ||
    manifestChanges.removedCommands.length > 0 ||
    manifestChanges.removedFlags.length > 0 ||
    manifestChanges.removedEnvVars.length > 0 ||
    schemaChanges.length > 0

  if (!hasBreaking) {
    return null
  }

  let report = `## ⚠️ Potential Breaking Changes Detected

This PR contains changes that may break the existing contract.

**@shopify/dev_experience** — this PR contains breaking changes that require coordination for the next major release. This check will remain failed until a member of the team approves the workflow run.

> 💬 Head to [#help-dev-platform](https://shopify.enterprise.slack.com/archives/C07UJ7UNMTK) to discuss timing and plan the release.

`

  if (majorChangesets.length > 0) {
    report += `### 📦 Major Version Changesets
The following changesets request a **major** version bump:

| Changeset | Package |
|-----------|---------|
`
    for (const cs of majorChangesets) {
      report += `| \`${cs.file}\` | ${cs.line} |\n`
    }
    report += '\n'
  }

  if (manifestChanges.removedCommands.length > 0) {
    report += `### 🗑️ Removed Commands
The following commands were removed from the OCLIF manifest:

${manifestChanges.removedCommands.map((cmd) => `- \`${cmd}\``).join('\n')}

`
  }

  if (manifestChanges.removedFlags.length > 0) {
    report += `### 🏳️ Removed Flags
The following flags were removed from existing commands:

| Command | Flag |
|---------|------|
`
    for (const f of manifestChanges.removedFlags) {
      report += `| \`${f.command}\` | \`--${f.flag}\` |\n`
    }
    report += '\n'
  }

  if (manifestChanges.removedEnvVars.length > 0) {
    report += `### 🔧 Removed Environment Variables
The following env vars are no longer referenced in command flags:

| Env Var | Previously Used By |
|---------|-------------------|
`
    for (const e of manifestChanges.removedEnvVars) {
      const usages = e.usages.map((u) => `\`${u.command} --${u.flag}\``).join(', ')
      report += `| \`${e.envVar}\` | ${usages} |\n`
    }
    report += '\n'
  }

  if (schemaChanges.length > 0) {
    report += `### 📝 Removed Schema Fields
The following Zod schema fields were removed or their files deleted:

| File | Removed Fields | Reason |
|------|---------------|--------|
`
    for (const entry of schemaChanges) {
      const fields = entry.fields.map((f) => `\`${f}\``).join(', ')
      const reason = entry.type === 'file_deleted' ? 'File deleted' : 'Fields removed'
      report += `| \`${entry.file}\` | ${fields} | ${reason} |\n`
    }
    report += '\n'
  }

  return report
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'major-change-check-'))

try {
  const baselineDirectory = await cloneCLIRepository(tmpDir)

  const majorChangesets = await checkChangesets()
  const manifestChanges = await checkManifest(baselineDirectory)
  const schemaChanges = await checkSchemas(baselineDirectory)

  const report = buildReport({majorChangesets, manifestChanges, schemaChanges})

  if (report) {
    logSection('\n⚠️  Breaking changes detected!')
    setOutput('has_breaking_changes', 'true')
    setOutput('report', report)
  } else {
    logSection('\n✅ No breaking changes detected')
    setOutput('has_breaking_changes', 'false')
  }
} finally {
  await rm(tmpDir, {recursive: true, force: true, maxRetries: 2})
}
