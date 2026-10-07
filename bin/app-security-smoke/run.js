#! /usr/bin/env node

/**
 * Smoke run for `shopify app security` agent checks against the React Router app template.
 * See README.md in this directory. Not run in CI: it drives real coding agents.
 */

import {spawn, execFileSync} from 'node:child_process'
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join, resolve as resolvePath} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '../..')
const CLI_ENTRY = join(REPO_ROOT, 'packages/cli/bin/dev.js')
const FIXTURE_PATH = join(
  REPO_ROOT,
  'packages/app/src/cli/services/app-security-engine/tests/fixtures/react-router-template.ts',
)

const TEMPLATE_REPOSITORY = 'https://github.com/Shopify/shopify-app-template-react-router.git'
const TEMPLATE_BRANCH = 'main-cli'
const TEMPLATE_REF = 'ea3008dad983c5509371b5130a1bcbefe8346b43'

const RESULTS_FILE = '.shopify/app-security/shopify.app/agent-findings.json'

/** The checks this smoke run calibrates. */
const FOCUS_CHECKS = ['METAFIELD_OFFLINE_TOKEN', 'MISSING_AUTHORIZATION_CHECK', 'STATIC_FRAME_ANCESTORS']

/** Findings the unmodified template is expected to have; see the fixture test for why. */
const EXPECTED_TEMPLATE_FINDINGS = ['MISSING_COMPLIANCE_WEBHOOKS', 'MISSING_DEPENDENCY_SECURITY_AUTOMATION']

/** One planted bug per focus check, added to the template for the negative control. */
const PLANTED_FILES = {
  METAFIELD_OFFLINE_TOKEN: 'app/routes/api.demo-info.tsx',
  MISSING_AUTHORIZATION_CHECK: 'app/routes/app.cleanup.tsx',
  STATIC_FRAME_ANCESTORS: 'app/entry.server.tsx',
}

const PROMPT =
  'Run a Shopify app security check on this app and record the results. The Shopify CLI is available as `shopify` on PATH. ' +
  'Start by running `shopify app security instructions` and follow those instructions completely, including recording ' +
  'results and running review. Do not modify app source files.'

const DEFAULT_AGENT_COMMANDS = {
  codex: 'codex exec --dangerously-bypass-approvals-and-sandbox "$SMOKE_PROMPT" < /dev/null',
  claude: 'claude -p --dangerously-skip-permissions "$SMOKE_PROMPT" < /dev/null',
}

const USAGE = `Usage:
  node bin/app-security-smoke/run.js [run] [--runs 3] [--agents codex,claude] [--scenarios template,negative]
                                     [--concurrency 4] [--timeout-minutes 20] [--work-dir DIR]
  node bin/app-security-smoke/run.js write-fixture

Agent commands default to:
  codex:  ${DEFAULT_AGENT_COMMANDS.codex}
  claude: ${DEFAULT_AGENT_COMMANDS.claude}
Override them with APP_SECURITY_SMOKE_CODEX_COMMAND and APP_SECURITY_SMOKE_CLAUDE_COMMAND. The prompt is in $SMOKE_PROMPT.`

function run(command, args, options = {}) {
  return execFileSync(command, args, {encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'], ...options})
}

function commit(directory, message) {
  const identity = ['-c', 'user.name=app-security-smoke', '-c', 'user.email=app-security-smoke@example.com']
  run('git', ['add', '-A'], {cwd: directory})
  run('git', [...identity, 'commit', '--quiet', '--no-verify', '-m', message], {cwd: directory})
}

/**
 * Fills the fields `shopify app init` writes when it links the app, so `shopify app security check` can parse the
 * configuration without a Partners account.
 */
function linkAppConfiguration(appDirectory) {
  const path = join(appDirectory, 'shopify.app.toml')
  const original = readFileSync(path, 'utf-8')
  const linked = original.replace(
    'client_id = ""\n',
    [
      'client_id = "0123456789abcdef0123456789abcdef"',
      'name = "app-security-smoke"',
      'application_url = "https://example.com"',
      'embedded = true',
      '',
    ].join('\n'),
  )
  if (linked === original) throw new Error(`Couldn't find an empty client_id in ${path}`)
  writeFileSync(path, `${linked.trimEnd()}\n\n[auth]\nredirect_urls = [ "https://example.com/api/auth" ]\n`)
}

/** Clones the template at the pinned commit and applies the parts of `shopify app init` that change scanned files. */
function scaffoldTemplate(appDirectory) {
  run('git', ['clone', '--quiet', '--branch', TEMPLATE_BRANCH, TEMPLATE_REPOSITORY, appDirectory])
  run('git', ['checkout', '--quiet', TEMPLATE_REF], {cwd: appDirectory})
  // `shopify app init` removes these (services/init/template/cleanup.ts).
  for (const path of ['.git', '.github', 'LICENSE.md']) rmSync(join(appDirectory, path), {recursive: true, force: true})
  linkAppConfiguration(appDirectory)
}

const PLANTED_METAFIELD_ROUTE = `import type { ActionFunctionArgs } from "react-router";
import { unauthenticated } from "../shopify.server";

// Lets a storefront widget update the demo info metafield on a product.
export const action = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop")!;
  const form = await request.formData();
  const { admin } = await unauthenticated.admin(shop);
  await admin.graphql(
    \`#graphql
    mutation setDemoInfo($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) { userErrors { message } }
    }\`,
    {
      variables: {
        metafields: [
          {
            ownerId: String(form.get("productId")),
            namespace: "$app",
            key: "demo_info",
            value: String(form.get("value")),
          },
        ],
      },
    },
  );
  return Response.json({ ok: true });
};
`

const PLANTED_AUTHORIZATION_ROUTE = `import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// Only app administrators (by Shopify staff user ID) may use bulk cleanup.
const APP_ADMIN_USER_IDS = new Set((process.env.APP_ADMIN_USER_IDS ?? "").split(","));

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { sessionToken } = await authenticate.admin(request);
  if (!APP_ADMIN_USER_IDS.has(String(sessionToken?.sub))) {
    throw new Response("Forbidden", { status: 403 });
  }
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const ids = String(form.get("productIds")).split(",");
  for (const id of ids) {
    await admin.graphql(
      \`#graphql
      mutation deleteProduct($input: ProductDeleteInput!) {
        productDelete(input: $input) { deletedProductId }
      }\`,
      { variables: { input: { id } } },
    );
  }
  return { deleted: ids.length };
};

export default function Cleanup() {
  return null;
}
`

/** Adds one bug per focus check. The CSP is built from a variable, so only the agent can see the wildcard. */
function plantBugs(appDirectory) {
  writeFileSync(join(appDirectory, PLANTED_FILES.METAFIELD_OFFLINE_TOKEN), PLANTED_METAFIELD_ROUTE)
  writeFileSync(join(appDirectory, PLANTED_FILES.MISSING_AUTHORIZATION_CHECK), PLANTED_AUTHORIZATION_ROUTE)
  const entryPath = join(appDirectory, PLANTED_FILES.STATIC_FRAME_ANCESTORS)
  const entry = readFileSync(entryPath, 'utf-8')
  const anchor = '  addDocumentResponseHeaders(request, responseHeaders);\n'
  if (!entry.includes(anchor)) throw new Error(`Couldn't find addDocumentResponseHeaders in ${entryPath}`)
  const override =
    '  const frameAncestors = ["https://*.myshopify.com", "https://admin.shopify.com"];\n' +
    '  responseHeaders.set("Content-Security-Policy", `frame-ancestors ${frameAncestors.join(" ")};`);\n'
  writeFileSync(entryPath, entry.replace(anchor, anchor + override))
}

function prepareBases(workDirectory) {
  const template = join(workDirectory, 'base-template')
  console.log(`Scaffolding ${TEMPLATE_BRANCH}@${TEMPLATE_REF.slice(0, 7)} in ${template}`)
  scaffoldTemplate(template)
  run('pnpm', ['install', '--silent'], {cwd: template, stdio: ['ignore', 'ignore', 'inherit']})
  run('git', ['init', '--quiet'], {cwd: template})
  commit(template, 'Template')

  const negative = join(workDirectory, 'base-negative')
  cpSync(template, negative, {recursive: true, verbatimSymlinks: true})
  plantBugs(negative)
  commit(negative, 'Planted bugs')
  return {template, negative}
}

function writeShopifyShim(workDirectory) {
  const binDirectory = join(workDirectory, 'bin')
  mkdirSync(binDirectory, {recursive: true})
  const shim = join(binDirectory, 'shopify')
  writeFileSync(shim, `#!/bin/sh\nexec node "${CLI_ENTRY}" "$@"\n`)
  chmodSync(shim, 0o755)
  return binDirectory
}

function runAgent({name, agent, baseDirectory, workDirectory, binDirectory, timeoutMinutes}) {
  const appDirectory = join(workDirectory, 'runs', name)
  cpSync(baseDirectory, appDirectory, {recursive: true, verbatimSymlinks: true})
  const command =
    process.env[`APP_SECURITY_SMOKE_${agent.toUpperCase()}_COMMAND`] ?? DEFAULT_AGENT_COMMANDS[agent]
  const logPath = join(workDirectory, 'runs', `${name}.log`)
  const started = Date.now()

  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', `${command} > "${logPath}" 2>&1`], {
      cwd: appDirectory,
      env: {
        ...process.env,
        PATH: `${binDirectory}:${process.env.PATH}`,
        SHOPIFY_CLI_NO_ANALYTICS: '1',
        SMOKE_PROMPT: PROMPT,
      },
      stdio: 'ignore',
    })
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMinutes * 60 * 1000)
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      const seconds = Math.round((Date.now() - started) / 1000)
      resolve({name, agent, appDirectory, logPath, exit: signal ?? code, seconds})
    })
  })
}

function outcomeFor(check, scenario) {
  if (!check) return 'missing'
  if (scenario === 'negative') {
    const planted = PLANTED_FILES[check.id]
    if (check.findings.some((finding) => finding.location.file === planted)) return 'caught'
  }
  if (check.findings.length > 0) return 'finding'
  return check.status === 'executed' ? 'clean' : check.status
}

function evaluate(result, scenario) {
  const resultsPath = join(result.appDirectory, RESULTS_FILE)
  if (!existsSync(resultsPath)) return {...result, scenario, recorded: false, passed: false, focus: {}, other: []}
  const document = JSON.parse(readFileSync(resultsPath, 'utf-8'))
  const checks = new Map(document.checks.map((check) => [check.id, check]))
  const focus = Object.fromEntries(FOCUS_CHECKS.map((id) => [id, outcomeFor(checks.get(id), scenario)]))
  const other = document.checks
    .filter((check) => !FOCUS_CHECKS.includes(check.id))
    .filter((check) => check.status === 'unresolved' || check.findings.length > 0)
    .filter((check) => scenario !== 'template' || !EXPECTED_TEMPLATE_FINDINGS.includes(check.id) || check.status !== 'executed')
    .map((check) => `${check.id}=${check.findings.length > 0 ? `${check.findings.length} finding(s)` : check.status}`)
  const wanted = scenario === 'negative' ? 'caught' : 'clean'
  const passed = Object.values(focus).every((outcome) => outcome === wanted)
  return {...result, scenario, recorded: true, passed, focus, other}
}

async function runWithConcurrency(tasks, concurrency) {
  const results = []
  const queue = [...tasks]
  const workers = Array.from({length: Math.min(concurrency, queue.length)}, async () => {
    while (queue.length > 0) {
      const task = queue.shift()
      results.push(await task())
    }
  })
  await Promise.all(workers)
  return results
}

function printSummary(results) {
  console.log('')
  for (const result of results.sort((left, right) => left.name.localeCompare(right.name))) {
    const focus = result.recorded
      ? FOCUS_CHECKS.map((id) => `${id}=${result.focus[id]}`).join(' ')
      : 'no agent-findings.json'
    const other = result.other.length > 0 ? ` | other: ${result.other.join(' ')}` : ''
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name} (${result.seconds}s) ${focus}${other}`)
  }
  console.log('')
  for (const scenario of ['template', 'negative']) {
    const scenarioResults = results.filter((result) => result.scenario === scenario)
    if (scenarioResults.length === 0) continue
    const label = scenario === 'template' ? 'clean' : 'all planted bugs caught'
    const passed = scenarioResults.filter((result) => result.passed).length
    console.log(`${scenario}: ${label} ${passed}/${scenarioResults.length}`)
    for (const id of FOCUS_CHECKS) {
      const wanted = scenario === 'negative' ? 'caught' : 'clean'
      const count = scenarioResults.filter((result) => result.focus[id] === wanted).length
      console.log(`  ${id}: ${wanted} ${count}/${scenarioResults.length}`)
    }
  }
}

async function smoke(values) {
  if (!existsSync(join(REPO_ROOT, 'packages/app/dist'))) {
    throw new Error('Build the CLI first: pnpm nx build cli')
  }
  const workDirectory = resolvePath(values['work-dir'] ?? mkdtempSync(join(tmpdir(), 'app-security-smoke-')))
  mkdirSync(join(workDirectory, 'runs'), {recursive: true})
  const bases = prepareBases(workDirectory)
  const binDirectory = writeShopifyShim(workDirectory)
  const agents = values.agents.split(',').filter(Boolean)
  const scenarios = values.scenarios.split(',').filter(Boolean)
  for (const agent of agents) {
    if (!DEFAULT_AGENT_COMMANDS[agent]) throw new Error(`Unknown agent ${agent}. Use codex or claude.`)
  }

  const tasks = []
  for (const scenario of scenarios) {
    if (!bases[scenario]) throw new Error(`Unknown scenario ${scenario}. Use template or negative.`)
    for (const agent of agents) {
      for (let index = 1; index <= Number(values.runs); index++) {
        const name = `${scenario}-${agent}-${index}`
        tasks.push(async () => {
          const result = await runAgent({
            name,
            agent,
            baseDirectory: bases[scenario],
            workDirectory,
            binDirectory,
            timeoutMinutes: Number(values['timeout-minutes']),
          })
          const evaluated = evaluate(result, scenario)
          console.log(`${evaluated.passed ? 'PASS' : 'FAIL'} ${name} (${result.seconds}s)`)
          return evaluated
        })
      }
    }
  }
  console.log(`Running ${tasks.length} agent passes, ${values.concurrency} at a time. Logs: ${join(workDirectory, 'runs')}`)
  const results = await runWithConcurrency(tasks, Number(values.concurrency))
  printSummary(results)
  writeFileSync(join(workDirectory, 'summary.json'), `${JSON.stringify(results, null, 2)}\n`)
  console.log(`\nSummary: ${join(workDirectory, 'summary.json')}`)
  return results.every((result) => result.passed) ? 0 : 1
}

/** Text files a fresh app has that the deterministic scan reads; docs, styles, and binaries don't affect it. */
function isFixtureFile(path) {
  return !/\.(md|css|ico|png|svg)$/.test(path)
}

function writeFixture() {
  const scratch = mkdtempSync(join(tmpdir(), 'app-security-fixture-'))
  try {
    const appDirectory = join(scratch, 'app')
    scaffoldTemplate(appDirectory)
    const files = run('find', ['.', '-type', 'f', '-not', '-path', './node_modules/*'], {cwd: appDirectory})
      .split('\n')
      .filter(Boolean)
      .map((path) => path.replace(/^\.\//, ''))
      .filter(isFixtureFile)
      .sort()
    const entries = files
      .map((path) => `  ${JSON.stringify(path)}: ${JSON.stringify(readFileSync(join(appDirectory, path), 'utf-8'))},`)
      .join('\n')
    const output = `// AUTO-GENERATED by bin/app-security-smoke/run.js write-fixture — do not edit.
/* eslint-disable no-template-curly-in-string */

/**
 * Shopify/shopify-app-template-react-router \`${TEMPLATE_BRANCH}\` at the commit below, as \`shopify app init\` leaves it
 * (no \`.git\`, \`.github\` or \`LICENSE.md\`), with placeholder values in \`shopify.app.toml\` for the fields that linking
 * the app writes. Docs, styles and binaries are left out.
 */
export const REACT_ROUTER_TEMPLATE_REF = '${TEMPLATE_REF}'

export const REACT_ROUTER_TEMPLATE_FILES: {[path: string]: string} = {
${entries}
}
`
    writeFileSync(FIXTURE_PATH, output)
    run(join(REPO_ROOT, 'node_modules/.bin/prettier'), ['--write', FIXTURE_PATH], {cwd: REPO_ROOT})
    console.log(`Wrote ${files.length} files to ${FIXTURE_PATH}`)
  } finally {
    rmSync(scratch, {recursive: true, force: true})
  }
}

const {positionals, values} = parseArgs({
  allowPositionals: true,
  options: {
    runs: {type: 'string', default: '3'},
    agents: {type: 'string', default: 'codex,claude'},
    scenarios: {type: 'string', default: 'template,negative'},
    concurrency: {type: 'string', default: '4'},
    'timeout-minutes': {type: 'string', default: '20'},
    'work-dir': {type: 'string'},
    help: {type: 'boolean', default: false},
  },
})

const command = positionals[0] ?? 'run'
if (values.help) {
  console.log(USAGE)
} else if (command === 'write-fixture') {
  writeFixture()
} else if (command === 'run') {
  process.exitCode = await smoke(values)
} else {
  console.error(USAGE)
  process.exitCode = 1
}
