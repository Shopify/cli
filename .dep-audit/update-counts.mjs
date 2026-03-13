/**
 * Reads all merged Dependabot PRs since 2024-03-13, counts occurrences per
 * package (by parsing both individual-bump titles and group-bump PR bodies),
 * updates each checkpoint JSON with dependabot_bumps_24m, and rewrites the CSV.
 *
 * Run with: node .dep-audit/update-counts.mjs
 */

import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));

// ── 1. Fetch all merged dependabot PRs since the cutoff ────────────────────

// Use --state all so closed (superseded) PRs are included — each still represents
// a real upstream release that triggered dependabot. Date the PR by mergedAt if
// merged, closedAt if closed without merging, createdAt as fallback.
const raw = execSync(
  `gh pr list --repo Shopify/cli --author "app/dependabot" --state all --limit 1000 ` +
  `--json number,title,state,mergedAt,closedAt,createdAt`,
  {encoding: 'utf8'},
);
const allPrs = JSON.parse(raw);
const prs = allPrs.filter(pr => {
  const date = pr.mergedAt || pr.closedAt || pr.createdAt;
  return date >= '2024-03-13';
});
console.log(`Found ${prs.length} Dependabot PRs (merged + closed) since 2024-03-13 (${allPrs.length} total)`);

// ── 2. Build package→count map ─────────────────────────────────────────────

const counts = {}; // package name → number of PRs

function increment(pkg) {
  if (!pkg) return;
  counts[pkg] = (counts[pkg] || 0) + 1;
}

// Extract package name from an individual-bump title like:
//   "Bump lodash from 4.x to 4.y"
//   "Bump lodash from 4.x to 4.y in /packages/cli-kit"
//   "Bump @scope/pkg from X to Y"
function extractPackageFromTitle(title) {
  const m = title.match(/^Bump (@?[a-z0-9][\w./\-]*)(?:\/[^\s]*)? from /i);
  return m ? m[1] : null;
}

// Extract all package names from a group PR body (markdown tables + inline mentions).
// Only parse the summary section — truncate before the first detailed release-notes block
// to avoid counting transitive deps mentioned in embedded changelogs.
function extractPackagesFromBody(body) {
  // The summary tables appear near the top; detailed "Updates `pkg`" release notes follow
  // after a "---" horizontal rule or after the first standalone "Updates `" line.
  const cutoff = body.search(/\n---\n|\nUpdates `/);
  const summary = cutoff > 0 ? body.slice(0, cutoff) : body;

  const pkgs = new Set();
  // Markdown table rows: | [@scope/pkg](url) | ... |  or  | [pkg](url) | ... |
  for (const m of summary.matchAll(/\|\s*\[(@?[a-z0-9][\w./\-]*)\]/gi)) {
    pkgs.add(m[1]);
  }
  // Inline "Bumps the X group with N update(s) in ... directory: [pkg](url)" mentions
  for (const m of summary.matchAll(/directory:\s*\[(@?[a-z0-9][\w./\-]*)\]/gi)) {
    pkgs.add(m[1]);
  }
  return [...pkgs];
}

const groupPrNumbers = [];

for (const pr of prs) {
  const isGroup =
    pr.title.includes('group') ||
    pr.title.includes('the esbuild') ||
    pr.title.includes('the oclif') ||
    pr.title.includes('the babel') ||
    pr.title.includes('the nx') ||
    pr.title.includes('the minor_versions') ||
    pr.title.includes('the development_dependencies') ||
    pr.title.includes('the typescript');

  if (isGroup) {
    groupPrNumbers.push(pr.number);
  } else {
    const pkg = extractPackageFromTitle(pr.title);
    if (pkg) increment(pkg);
  }
}

// ── 3. Fetch bodies for group PRs ──────────────────────────────────────────

console.log(`Fetching bodies for ${groupPrNumbers.length} group PRs…`);
for (const num of groupPrNumbers) {
  try {
    const body = execSync(
      `gh pr view ${num} --repo Shopify/cli --json body --jq '.body'`,
      {encoding: 'utf8'},
    );
    const pkgs = extractPackagesFromBody(body);
    for (const pkg of pkgs) increment(pkg);
  } catch (e) {
    console.warn(`  Warning: could not fetch PR #${num}: ${e.message}`);
  }
}

console.log('\nDependabot bump counts (packages with ≥1 bump):');
const sorted = Object.entries(counts)
  .filter(([, c]) => c > 0)
  .sort(([, a], [, b]) => b - a);
for (const [pkg, c] of sorted) {
  console.log(`  ${c.toString().padStart(3)}  ${pkg}`);
}

// ── 4. Update checkpoint files ─────────────────────────────────────────────

const checkpointFiles = fs.readdirSync(dir).filter(
  f => f.endsWith('.json') && !f.startsWith('_'),
);

let updated = 0;
for (const file of checkpointFiles) {
  const fp = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const c = counts[data.name] ?? 0;
  data.dependabot_bumps_24m = c;
  // Remove the old unreliable field
  delete data.total_releases_24m;
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n');
  updated++;
}
console.log(`\nUpdated ${updated} checkpoint files with dependabot_bumps_24m`);

// ── 5. Rewrite _audit.csv ──────────────────────────────────────────────────

function csvField(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const rows = [];
for (const file of checkpointFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  rows.push({
    dependency_name: data.name || '',
    packages_declaring: Array.isArray(data.packages_declaring)
      ? data.packages_declaring.join('; ')
      : (data.packages_declaring || ''),
    used: data.used || '',
    dependabot_bumps_24m: data.dependabot_bumps_24m ?? 0,
    removal_candidate: data.removal_candidate || '',
    replacement_effort: data.replacement_effort || '',
    how_to_remove: data.how_to_remove || '',
    replacement_dependency: data.replacement_dependency || '',
    replacement_reason: data.replacement_reason || '',
  });
}

rows.sort((a, b) => {
  const aYes = a.removal_candidate === 'yes' ? 0 : 1;
  const bYes = b.removal_candidate === 'yes' ? 0 : 1;
  if (aYes !== bYes) return aYes - bYes;
  return a.dependency_name.localeCompare(b.dependency_name);
});

const header =
  'dependency_name,packages_declaring,used,dependabot_bumps_24m,removal_candidate,replacement_effort,how_to_remove,replacement_dependency,replacement_reason';
const csvLines = [header];
for (const row of rows) {
  csvLines.push(
    [
      csvField(row.dependency_name),
      csvField(row.packages_declaring),
      csvField(row.used),
      csvField(row.dependabot_bumps_24m),
      csvField(row.removal_candidate),
      csvField(row.replacement_effort),
      csvField(row.how_to_remove),
      csvField(row.replacement_dependency),
      csvField(row.replacement_reason),
    ].join(','),
  );
}

fs.writeFileSync(path.join(dir, '_audit.csv'), csvLines.join('\n') + '\n');

const total = rows.length;
const removalYes = rows.filter(r => r.removal_candidate === 'yes').length;
const hasReplacement = rows.filter(
  r => r.replacement_dependency && r.replacement_dependency !== 'none' && r.replacement_dependency !== '',
).length;

console.log('\n── Final summary ─────────────────────────────────────────');
console.log(`CSV written to .dep-audit/_audit.csv`);
console.log(`Total dependencies: ${total}`);
console.log(`Removal candidates: ${removalYes}`);
console.log(`With suggested replacement: ${hasReplacement}`);
