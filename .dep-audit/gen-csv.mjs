import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));

// ── Overlap / duplication data ──────────────────────────────────────────────
// Maps each dep to the functional group it belongs to and what the
// consolidation recommendation is.  Deps not listed here have no known overlap.
const OVERLAP = {
  // Terminal color / styling
  'chalk':               {group: 'terminal-colors', note: 'keep – core color API'},
  'gradient-string':     {group: 'terminal-colors', note: 'absorb into chalk – inline HSV gradient (~30 lines)'},
  'ansi-escapes':        {group: 'terminal-colors', note: 'inline – OSC 8 link is a 2-line function'},
  'color-json':          {group: 'terminal-colors', note: 'absorb into chalk – inline JSON colorizer'},
  'strip-ansi':          {group: 'terminal-colors', note: 'inline – single /\\x1B\\[[0-9;]*m/g regex'},
  'terminal-link':       {group: 'terminal-colors', note: 'redundant with ansi-escapes.link() – drop terminal-link'},
  'supports-hyperlinks': {group: 'terminal-colors', note: 'inline – 3-line env-var check; pairs with ansi-escapes'},

  // Runtime validation
  'zod':                                   {group: 'validation', note: 'keep – primary validation library (60+ files)'},
  'ajv':                                   {group: 'validation', note: 'consolidate into zod – single file (json-schema.ts); medium effort'},
  '@apidevtools/json-schema-ref-parser':   {group: 'validation', note: 'drop with ajv – only used to pre-process schemas before Ajv; inline $ref resolution (~30 lines)'},

  // String case conversion
  'change-case':   {group: 'string-case', note: 'keep – public cli-kit API, 6 functions'},
  'camelcase-keys': {group: 'string-case', note: 'absorb into change-case – inline helper using camelCase()'},

  // Object / data utilities
  'lodash':    {group: 'object-utils', note: 'keep – entrenched in public APIs'},
  'deepmerge': {group: 'object-utils', note: 'absorb into lodash – use lodash.merge or 15-line inline'},

  // Config / template parsers
  'liquidjs':     {group: 'config-parsers', note: 'keep – Shopify Liquid engine'},
  '@iarna/toml':  {group: 'config-parsers', note: 'replace with smol-toml – drop-in, actively maintained'},
  'yaml':         {group: 'config-parsers', note: 'inline – only yaml.stringify used; 3 call sites'},

  // Glob / file pattern matching
  'fast-glob':  {group: 'glob-matching', note: 'keep – core file discovery (147+ sites)'},
  'minimatch':  {group: 'glob-matching', note: 'replace with micromatch – already a transitive dep via fast-glob'},
  'ignore':     {group: 'glob-matching', note: 'keep – gitignore semantics; different purpose from fast-glob'},

  // HTTP clients
  'node-fetch':      {group: 'http-client', note: 'keep (migrate to Node 18+ built-in fetch – medium)'},
  'graphql-request': {group: 'http-client', note: 'keep – GraphQL transport layer'},
  'graphql':         {group: 'http-client', note: 'keep – peer dep of graphql-request; also used for AST parsing'},
  'express':         {group: 'http-client', note: 'replace with Node http module – only used for 6-route GraphiQL server'},

  // ESLint: documentation rules
  'eslint-plugin-jsdoc':   {group: 'eslint-docs', note: 'keep – active, covers public API files'},
  'eslint-plugin-tsdoc':   {group: 'eslint-docs', note: 'consolidate into eslint-plugin-jsdoc – overlapping TSDoc syntax enforcement'},

  // ESLint: React rules
  'eslint-plugin-react':       {group: 'eslint-react', note: 'keep – React/JSX linting'},
  'eslint-plugin-react-hooks': {group: 'eslint-react', note: 'drop in React 19+ – hooks plugin ships bundled in react package itself'},

  // Test DOM utilities
  'jsdom':                     {group: 'test-dom', note: 'replace with happy-dom – lighter weight, Vitest-recommended'},
  '@testing-library/jest-dom': {group: 'test-dom', note: 'inline – replace toBeInTheDocument() etc. with Vitest native assertions'},
};
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));

function removalSummary(data) {
  const bumps = data.dependabot_bumps_24m ?? 0;
  const effort = data.replacement_effort || '';
  const candidate = data.removal_candidate === 'yes';

  if (!candidate) {
    if (bumps >= 5) return 'Keep – high churn, hard to remove';
    if (bumps >= 1) return 'Keep – active upstream, hard to remove';
    return 'Keep – stable, hard to remove';
  }

  if (data.used === 'no') return 'Remove – unused';

  const churnNote = bumps === 0 ? 'no upstream churn' : `cuts ${bumps} dependabot bump${bumps === 1 ? '' : 's'}`;

  if (effort === 'trivial') return `Quick win – trivial removal, ${churnNote}`;
  if (effort === 'small')   return `Easy win – small effort, ${churnNote}`;
  return `Candidate – ${effort} effort, ${churnNote}`;
}

function csvField(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const rows = [];
for (const file of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const overlap = OVERLAP[data.name] || {};
    rows.push({
      dependency_name: data.name || '',
      packages_declaring: Array.isArray(data.packages_declaring) ? data.packages_declaring.join('; ') : (data.packages_declaring || ''),
      used: data.used || '',
      dependabot_bumps_24m: data.dependabot_bumps_24m ?? 0,
      removal_candidate: data.removal_candidate || '',
      removal_summary: removalSummary(data),
      overlap_group: overlap.group || '',
      consolidation_note: overlap.note || '',
      replacement_effort: data.replacement_effort || '',
      how_to_remove: data.how_to_remove || '',
      replacement_dependency: data.replacement_dependency || '',
      replacement_reason: data.replacement_reason || '',
    });
  } catch(e) {
    console.error('Error reading ' + file + ': ' + e.message);
  }
}

// Sort: removal_candidate=yes first, then no; within each group alphabetically
rows.sort((a, b) => {
  const aYes = a.removal_candidate === 'yes' ? 0 : 1;
  const bYes = b.removal_candidate === 'yes' ? 0 : 1;
  if (aYes !== bYes) return aYes - bYes;
  return a.dependency_name.localeCompare(b.dependency_name);
});

const header = 'dependency_name,packages_declaring,used,dependabot_bumps_24m,removal_candidate,removal_summary,overlap_group,consolidation_note,replacement_effort,how_to_remove,replacement_dependency,replacement_reason';
const csvLines = [header];
for (const row of rows) {
  csvLines.push([
    csvField(row.dependency_name),
    csvField(row.packages_declaring),
    csvField(row.used),
    csvField(row.dependabot_bumps_24m),
    csvField(row.removal_candidate),
    csvField(row.removal_summary),
    csvField(row.overlap_group),
    csvField(row.consolidation_note),
    csvField(row.replacement_effort),
    csvField(row.how_to_remove),
    csvField(row.replacement_dependency),
    csvField(row.replacement_reason),
  ].join(','));
}

fs.writeFileSync(path.join(dir, '_audit.csv'), csvLines.join('\n') + '\n');

const total = rows.length;
const removalYes = rows.filter(r => r.removal_candidate === 'yes').length;
const hasReplacement = rows.filter(r => r.replacement_dependency && r.replacement_dependency !== 'none' && r.replacement_dependency !== '').length;

console.log('CSV written to .dep-audit/_audit.csv');
console.log('Total dependencies audited: ' + total);
console.log('Resumed from checkpoints: 0 (all audited this run)');
console.log('Removal candidates: ' + removalYes);
console.log('With suggested replacement: ' + hasReplacement);

const yes = rows.filter(r => r.removal_candidate === 'yes');
console.log('\nRemoval candidates (' + yes.length + '):');
for (const r of yes) {
  const rep = (r.replacement_dependency && r.replacement_dependency !== 'none') ? ' -> ' + r.replacement_dependency : '';
  console.log('  ' + r.dependency_name + ' [' + r.replacement_effort + ']' + rep);
}
