#!/usr/bin/env node

/**
 * Detects potential breaking changes in a PR by checking:
 *
 * 1. Changesets requesting a major version bump
 * 2. OCLIF manifest changes: removed commands, removed flags, or removed flag env vars
 * 3. Zod schema changes: removed or renamed fields in app/extension config schemas
 *
 * Baseline selection:
 *   - On `pull_request` events the baseline is the merge-base of the PR
 *     head and the base branch. This avoids false positives when `main`
 *     has progressed past the PR's branch point (a field added on `main`
 *     after the PR opened would otherwise show up as "removed" by the PR).
 *   - On `merge_group` events the baseline is `merge_group.base_sha`,
 *     which is exactly the commit the merge queue is testing against.
 *   - Otherwise, falls back to `main`'s current tip (legacy behavior).
 *
 * The schema scan and OCLIF manifest comparison are scoped to files that
 * actually changed in the PR's diff so unrelated drift on `main` cannot
 * trigger this check.
 *
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
// Event context: pick the right baseline and the right diff to scan
// ---------------------------------------------------------------------------

/**
 * Reads `GITHUB_EVENT_PATH` and returns the baseline + diff context for the
 * check. Works for `pull_request`, `pull_request_review`, and `merge_group`
 * events; otherwise returns a legacy fallback that compares against `main`.
 *
 * Returned shape:
 *   {
 *     baselineRef: string,           // SHA or branch name to clone/checkout as baseline
 *     headSha: string | null,        // PR head SHA, or null in fallback mode
 *     repo: {owner, name},           // for GitHub API calls
 *     prNumber: number | null,       // for review/codeowner lookups
 *     changedFiles: Set<string> | null, // null = scan everything (fallback)
 *   }
 */
export async function resolveContext({
  eventName = process.env.GITHUB_EVENT_NAME,
  eventPath = process.env.GITHUB_EVENT_PATH,
  fetchCompare = defaultFetchCompare,
} = {}) {
  const repoSlug = process.env.GITHUB_REPOSITORY || 'Shopify/cli'
  const [owner, name] = repoSlug.split('/')
  const repo = {owner, name}

  // No event payload => running locally or in an unsupported event. Fall
  // back to legacy behavior so this script remains usable as a manual tool.
  if (!eventPath) {
    return {baselineRef: 'main', headSha: null, repo, prNumber: null, changedFiles: null}
  }

  let event
  try {
    event = JSON.parse(await fs.readFile(eventPath, 'utf-8'))
  } catch {
    return {baselineRef: 'main', headSha: null, repo, prNumber: null, changedFiles: null}
  }

  if ((eventName === 'pull_request' || eventName === 'pull_request_review') && event.pull_request) {
    const headSha = event.pull_request.head.sha
    const baseSha = event.pull_request.base.sha
    const prNumber = event.pull_request.number
    const compare = await fetchCompare(repo, baseSha, headSha)
    const baselineRef = compare?.merge_base_commit?.sha || baseSha
    // When the compare API fails we fall back to scanning everything
    // (changedFiles=null). Narrowing to an empty set would silently
    // suppress real breaking changes, which is unsafe.
    const changedFiles = compare?.files ? new Set(compare.files.map((f) => f.filename)) : null
    return {baselineRef, headSha, repo, prNumber, changedFiles}
  }

  if (eventName === 'merge_group' && event.merge_group) {
    const headSha = event.merge_group.head_sha
    const baselineRef = event.merge_group.base_sha
    const compare = await fetchCompare(repo, baselineRef, headSha)
    const changedFiles = compare?.files ? new Set(compare.files.map((f) => f.filename)) : null
    return {baselineRef, headSha, repo, prNumber: null, changedFiles}
  }

  return {baselineRef: 'main', headSha: null, repo, prNumber: null, changedFiles: null}
}

/**
 * Default GitHub compare-API fetcher. Uses the standard `GITHUB_TOKEN` so
 * it works on first-party PRs; falls back to unauthenticated for forks
 * (still works for public-repo compare). On any failure we return null and
 * the caller falls back to scanning everything — i.e. degrades to legacy
 * behavior, never silently ignores potential breaking changes.
 */
async function defaultFetchCompare(repo, base, head) {
  if (!base || !head) return null
  const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/compare/${base}...${head}`
  return githubGet(url)
}

async function githubGet(url) {
  const headers = {Accept: 'application/vnd.github+json'}
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const res = await fetch(url, {headers})
    if (!res.ok) {
      logMessage(`GitHub API ${url} returned ${res.status}`)
      return null
    }
    return await res.json()
  } catch (error) {
    logMessage(`GitHub API ${url} failed: ${error.message}`)
    return null
  }
}

// ---------------------------------------------------------------------------
// Code-owner approval override
// ---------------------------------------------------------------------------

/**
 * Parses a CODEOWNERS file body and returns an array of
 * `{pattern, owners: ["@org/team", "@user", ...]}`.
 *
 * Comments and blank lines are skipped. Order is preserved (the last
 * matching rule wins, per CODEOWNERS semantics).
 */
export function parseCodeowners(content) {
  const rules = []
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const tokens = line.split(/\s+/)
    if (tokens.length < 2) continue
    const [pattern, ...owners] = tokens
    rules.push({pattern, owners})
  }
  return rules
}

/**
 * Convert a CODEOWNERS pattern into a RegExp.
 *
 * This is a deliberately conservative translation: it covers the patterns
 * actually used in this repo (leading `*`, leading `/`, directory globs)
 * but does not aim for full gitignore compatibility. CODEOWNERS
 * mis-matches here only affect whether the override is *granted*; the
 * detection itself is unchanged, so a too-narrow regex just falls back to
 * "no override" rather than silently approving the wrong thing.
 */
export function codeownersPatternToRegExp(pattern) {
  let p = pattern
  // A pattern that doesn't start with `/` matches anywhere in the tree.
  const anchored = p.startsWith('/')
  if (anchored) p = p.slice(1)
  // A trailing `/` means "this directory and everything inside it".
  if (p.endsWith('/')) p = `${p}**`
  // `**` => any path segments, `*` => anything except `/`.
  let regex = ''
  let i = 0
  while (i < p.length) {
    const ch = p[i]
    if (ch === '*' && p[i + 1] === '*') {
      regex += '.*'
      i += 2
      if (p[i] === '/') i++ // consume the `/` after `**`
    } else if (ch === '*') {
      regex += '[^/]*'
      i++
    } else if ('.+?^$()[]{}|\\'.includes(ch)) {
      regex += `\\${ch}`
      i++
    } else {
      regex += ch
      i++
    }
  }
  return new RegExp(anchored ? `^${regex}$` : `(^|/)${regex}$`)
}

/**
 * Returns the set of CODEOWNERS owner handles (teams and users, with the
 * leading `@`) responsible for any of the given changed files. Per
 * CODEOWNERS semantics the *last* matching rule wins.
 */
export function ownersForFiles(rules, files) {
  const compiled = rules.map((r) => ({...r, regex: codeownersPatternToRegExp(r.pattern)}))
  const owners = new Set()
  for (const file of files) {
    let match = null
    for (const rule of compiled) {
      if (rule.regex.test(file)) match = rule
    }
    if (match) match.owners.forEach((o) => owners.add(o))
  }
  return owners
}

/**
 * Checks whether the PR has been approved by anyone who can plausibly
 * count as a code-owner approval. Returns `{approved: bool, approver: string | null}`.
 *
 * "Plausibly" intentionally means "a member of the org with write access
 * to this repo". The default GITHUB_TOKEN can't list arbitrary team
 * memberships across the org, but it can read repo-level permissions, and
 * for Shopify/cli the CODEOWNERS file is `* @shopify/dev_experience`
 * top-level, with team-only overrides for a couple of paths. Any human
 * with write access on this repo is in one of those teams (the team grant
 * is what gives them write access). This is the same security posture as
 * branch protection's "require code-owner review" rule, just evaluated
 * earlier so the check can flip green without manually re-running CI.
 */
export async function findCodeownerApproval({
  repo,
  prNumber,
  changedFiles,
  fetchReviews = defaultFetchReviews,
  fetchCodeowners = defaultFetchCodeowners,
  fetchPermission = defaultFetchPermission,
} = {}) {
  if (!prNumber) return {approved: false, approver: null, reason: 'no PR number in event'}

  const reviews = await fetchReviews(repo, prNumber)
  if (!reviews) return {approved: false, approver: null, reason: 'reviews API failed'}

  // Last review per author wins (matches GitHub's own "latest review" semantics).
  const latestByUser = new Map()
  for (const review of reviews) {
    if (!review.user?.login) continue
    latestByUser.set(review.user.login, review)
  }
  const approvers = [...latestByUser.values()].filter((r) => r.state === 'APPROVED').map((r) => r.user.login)
  if (approvers.length === 0) return {approved: false, approver: null, reason: 'no approving reviews'}

  // Optional refinement: if we have the CODEOWNERS file and the changed
  // files, only count approvers whose teams own a path in the diff. We
  // log it for transparency but don't gate on it — see the function
  // doc-comment for why.
  const codeowners = await fetchCodeowners(repo)
  if (codeowners && changedFiles && changedFiles.size > 0) {
    const owners = ownersForFiles(parseCodeowners(codeowners), [...changedFiles])
    if (owners.size > 0) logMessage(`Code owners for changed files: ${[...owners].join(', ')}`)
  }

  for (const approver of approvers) {
    const permission = await fetchPermission(repo, approver)
    if (permission === 'admin' || permission === 'write' || permission === 'maintain') {
      return {approved: true, approver, reason: `${approver} has ${permission} access`}
    }
  }
  return {approved: false, approver: null, reason: 'no approving reviewer has write access'}
}

async function defaultFetchReviews(repo, prNumber) {
  return githubGet(`https://api.github.com/repos/${repo.owner}/${repo.name}/pulls/${prNumber}/reviews?per_page=100`)
}

async function defaultFetchCodeowners(repo) {
  // Try the canonical locations (root, .github, docs).
  for (const candidate of ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']) {
    const data = await githubGet(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/contents/${candidate}`,
    )
    if (data?.content) return Buffer.from(data.content, 'base64').toString('utf-8')
  }
  return null
}

async function defaultFetchPermission(repo, username) {
  const data = await githubGet(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/collaborators/${username}/permission`,
  )
  return data?.permission || null
}

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

async function checkManifest(baselineDirectory, {changedFiles} = {}) {
  logSection('Checking OCLIF manifest for removed commands/flags')

  // The OCLIF manifest is a generated artifact — a removed command always
  // shows up as a `oclif.manifest.json` change. If the file isn't in the
  // PR diff there is by definition no surface change to detect.
  if (changedFiles && !changedFiles.has('packages/cli/oclif.manifest.json')) {
    logMessage('oclif.manifest.json unchanged in this PR, skipping')
    return {removedCommands: [], removedFlags: [], removedEnvVars: []}
  }

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
 * Returns a copy of `source` with strings, template literals, and comments
 * replaced by spaces (newlines preserved). This lets the caller do brace /
 * paren / bracket counting without false positives from `{`, `}`, `:` etc.
 * inside string or comment content. Indices are preserved 1:1.
 *
 * Note: this is a best-effort lexer, not a full TS grammar. It does NOT
 * track template-literal `${ ... }` interpolation expressions — anything
 * inside a backtick-quoted template (including the `${...}` expression
 * itself) is blanked out. That's safe for this use case because we only
 * collect identifiers at depth==0 of `.object(...)` / `.extend(...)`
 * argument blocks, and template literals are never used as keys.
 */
export function stripStringsAndComments(source) {
  const out = source.split('')
  let i = 0
  const len = out.length
  while (i < len) {
    const c = out[i]
    const n = i + 1 < len ? out[i + 1] : ''

    // Line comment
    if (c === '/' && n === '/') {
      out[i] = ' '
      out[i + 1] = ' '
      i += 2
      while (i < len && out[i] !== '\n') {
        out[i] = ' '
        i++
      }
      continue
    }

    // Block comment
    if (c === '/' && n === '*') {
      out[i] = ' '
      out[i + 1] = ' '
      i += 2
      while (i < len) {
        if (out[i] === '*' && i + 1 < len && out[i + 1] === '/') {
          out[i] = ' '
          out[i + 1] = ' '
          i += 2
          break
        }
        if (out[i] !== '\n') out[i] = ' '
        i++
      }
      continue
    }

    // String / template literal
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out[i] = ' '
      i++
      while (i < len && out[i] !== quote) {
        if (out[i] === '\\' && i + 1 < len) {
          out[i] = ' '
          if (out[i + 1] !== '\n') out[i + 1] = ' '
          i += 2
          continue
        }
        if (out[i] !== '\n') out[i] = ' '
        i++
      }
      if (i < len) {
        out[i] = ' '
        i++
      }
      continue
    }

    i++
  }
  return out.join('')
}

/**
 * Given `source` and an index `openIdx` pointing at `{`, returns the index
 * of the matching `}`, or -1 if unbalanced. Caller is expected to pass a
 * source that has already been run through stripStringsAndComments.
 */
function findMatchingBrace(source, openIdx) {
  let depth = 0
  for (let i = openIdx; i < source.length; i++) {
    const c = source[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Walks `source` from `start` (inclusive) to `end` (exclusive) and adds
 * every key declared at depth 0 to `out`. Recognizes:
 *   - bare identifiers:    foo: ...
 *   - quoted identifiers:  'foo': ...    or    "foo": ...
 *
 * This walks the original source (not the stripped version) so quoted keys
 * survive — but it tracks string and comment state inline so braces /
 * parens / colons inside string bodies don't confuse the depth counter.
 * Skips anything nested inside `{...}`, `[...]`, or `(...)`.
 */
function collectTopLevelKeys(source, start, end, out) {
  const keyRegex = /(?:(['"])([A-Za-z_]\w*)\1|([A-Za-z_]\w*))\s*:/y
  let depth = 0
  let i = start
  while (i < end) {
    const c = source[i]
    const n = i + 1 < end ? source[i + 1] : ''

    // Comments
    if (c === '/' && n === '/') {
      i += 2
      while (i < end && source[i] !== '\n') i++
      continue
    }
    if (c === '/' && n === '*') {
      i += 2
      while (i < end && !(source[i] === '*' && i + 1 < end && source[i + 1] === '/')) i++
      i += 2
      continue
    }

    // Template literals — never used as keys, just skip the whole thing.
    if (c === '`') {
      i++
      while (i < end && source[i] !== '`') {
        if (source[i] === '\\' && i + 1 < end) i += 2
        else i++
      }
      i++
      continue
    }

    // Quoted strings: at depth 0, check whether this is a quoted KEY (i.e.
    // followed by `:` after the closing quote). If so, the keyRegex below
    // will match it cleanly. Otherwise, skip the string body so its
    // contents don't perturb the depth counter.
    if (c === '"' || c === "'") {
      if (depth === 0) {
        keyRegex.lastIndex = i
        const km = keyRegex.exec(source)
        if (km && km.index === i) {
          out.add(km[2] || km[3])
          i += km[0].length
          continue
        }
      }
      const quote = c
      i++
      while (i < end && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < end) i += 2
        else i++
      }
      i++
      continue
    }

    if (c === '{' || c === '(' || c === '[') {
      depth++
      i++
      continue
    }
    if (c === '}' || c === ')' || c === ']') {
      depth--
      i++
      continue
    }

    // Bare-identifier key at depth 0
    if (depth === 0 && /[A-Za-z_]/.test(c)) {
      keyRegex.lastIndex = i
      const km = keyRegex.exec(source)
      if (km && km.index === i) {
        out.add(km[2] || km[3])
        i += km[0].length
        continue
      }
    }
    i++
  }
}

/**
 * Extracts top-level field names from Zod schema source files.
 *
 * Walks every `.object({...})` and `.extend({...})` block with a
 * brace-counting scan (so nested object literals don't truncate the parent
 * block) and collects the identifiers declared at depth 0 of each block.
 *
 * Both call sites matter:
 *   - `.object({...})` is the canonical Zod object literal.
 *   - `.extend({...})` is how spec files in
 *     `packages/app/src/cli/models/extensions/specifications/**` add their
 *     top-level fields onto a base schema (e.g. `BaseSchemaWithoutHandle.extend({...})`).
 *     Without this, removing a field added via `.extend` is undetectable.
 *
 * This is still a heuristic — it doesn't understand TypeScript types, only
 * the surface of the source. For full correctness, swap it out for an
 * AST-based extraction (`@typescript-eslint/parser` or the TS compiler API).
 * The brace-counted version is a strict superset of the previous regex;
 * any field the old extractor saw, this one sees too.
 */
export function extractSchemaFields(content) {
  const fields = new Set()
  const stripped = stripStringsAndComments(content)
  const callerRegex = /\.(?:object|extend)\s*\(\s*\{/g
  let m
  while ((m = callerRegex.exec(stripped)) !== null) {
    const openBraceIdx = m.index + m[0].length - 1
    const closeIdx = findMatchingBrace(stripped, openBraceIdx)
    if (closeIdx === -1) continue
    // Walk the ORIGINAL source within the brace-balanced range so quoted
    // keys survive — `stripped` was used only for safe brace counting.
    collectTopLevelKeys(content, openBraceIdx + 1, closeIdx, fields)
    callerRegex.lastIndex = closeIdx + 1
  }
  return fields
}

async function checkSchemas(baselineDirectory, {changedFiles} = {}) {
  logSection('Checking Zod schemas for removed fields')

  const schemaGlob = 'packages/app/src/cli/models/**/specifications/**/*.ts'
  const appModelGlob = 'packages/app/src/cli/models/app/app.ts'
  const ignorePatterns = ['**/*.test.ts', '**/*.test-data.ts']

  const baselineSchemaFiles = await fg([schemaGlob, appModelGlob], {
    cwd: baselineDirectory,
    ignore: ignorePatterns,
  })

  // When we know the PR's actual diff, only inspect schema files the PR
  // touched. Without this, drift on `main` (e.g. a field added after the
  // PR branched) is reported as a removal. With it, removals come strictly
  // from this PR's own changes.
  const filesToCheck = changedFiles
    ? baselineSchemaFiles.filter((file) => changedFiles.has(file))
    : baselineSchemaFiles

  if (changedFiles && filesToCheck.length === 0) {
    logMessage('No schema files changed in this PR, skipping')
    return []
  }

  const removedFields = []

  for (const file of filesToCheck) {
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

    // Only check files that actually contain a Zod object/extend block.
    // (`.object(` already subsumes `zod.object(`.)
    if (!baselineContent.includes('.object(') && !baselineContent.includes('.extend(')) continue

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

**@shopify/dev_experience** — this PR contains breaking changes that require coordination for the next major release. To unblock this check, an approving review from a code owner of the changed files (typically a \`@shopify/dev_experience\` member) is sufficient — the check will re-run automatically when the review is submitted and turn green.

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

// `import.meta.main` is only true when this file is run directly. When the
// test file imports it as a module, we don't want to spawn a baseline clone.
if (process.argv[1] && url.fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await runMain()
}

async function runMain() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'major-change-check-'))

  try {
    const context = await resolveContext()
    if (context.baselineRef !== 'main') {
      logMessage(`Resolved baseline to ${context.baselineRef.slice(0, 7)} (merge-base or merge-queue base)`)
    }
    if (context.changedFiles) {
      logMessage(`PR touched ${context.changedFiles.size} file(s); scoping schema/manifest scan to those`)
    }

    // This script consumes only git-tracked files (oclif.manifest.json + .ts
    // sources). It does not need the baseline's node_modules or dist output,
    // so we skip pnpm install and pnpm build to save ~5–10 minutes of CI
    // per PR. type-diff.js (which diffs `dist/**/*.d.ts`) keeps the default.
    const baselineDirectory = await cloneCLIRepository(tmpDir, {
      install: false,
      build: false,
      ref: context.baselineRef,
    })

    const majorChangesets = await checkChangesets()
    const manifestChanges = await checkManifest(baselineDirectory, {changedFiles: context.changedFiles})
    const schemaChanges = await checkSchemas(baselineDirectory, {changedFiles: context.changedFiles})

    const report = buildReport({majorChangesets, manifestChanges, schemaChanges})

    if (!report) {
      logSection('\n✅ No breaking changes detected')
      setOutput('has_breaking_changes', 'false')
      return
    }

    // Breaking changes were detected. If a code-owner has already approved
    // the PR, treat that as sign-off and turn the check green. The script
    // re-runs on `pull_request_review` events (see breaking-change-check.yml)
    // so a fresh approval will flip this check without manual CI re-runs.
    const override = await findCodeownerApproval({
      repo: context.repo,
      prNumber: context.prNumber,
      changedFiles: context.changedFiles,
    })
    if (override.approved) {
      logSection(`\n✅ Breaking changes detected, but overridden by ${override.approver}'s approval`)
      setOutput('has_breaking_changes', 'false')
      setOutput('report', `${report}\n---\n✅ Override: approved by @${override.approver}.\n`)
      return
    }

    logSection('\n⚠️  Breaking changes detected!')
    if (override.reason) logMessage(`Override not granted: ${override.reason}`)
    setOutput('has_breaking_changes', 'true')
    setOutput('report', report)
  } finally {
    await rm(tmpDir, {recursive: true, force: true, maxRetries: 2})
  }
}


