import {detectPosIntercepts} from './pos_intercept_detection.js'
import {detectPosInterceptsSimple} from './pos_intercept_detection_simple.js'
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, dirname} from 'node:path'
import {test} from 'vitest'

// ---------------------------------------------------------------------------
// RUNNABLE REPORT (not an assertion suite — it prints and exits 0).
//
// Shows the SIMPLE vs COMPLEX POS intercept detectors side-by-side over a
// curated set of samples that tell the story, including cases where the COMPLEX
// detector ALSO fails (its shallow data-flow has real limits).
//
// RUN:
//   cd packages/app && ../../node_modules/.bin/vitest run \
//     src/cli/models/extensions/specifications/pos_intercept_detection_report.test.ts
//
// Optional: run against a real file instead of the built-in samples:
//   REPORT_PATH=/abs/path/to/entry.ts ../../node_modules/.bin/vitest run \
//     src/cli/models/extensions/specifications/pos_intercept_detection_report.test.ts
// ---------------------------------------------------------------------------

interface Sample {
  name: string
  label: string
  /** Minimal code shown in the report (just enough to understand the sample). */
  show: string
  /** entry filename within the sample dir. */
  entry: string
  /** filename -> source content (verbatim) actually written + analyzed. */
  files: {[filename: string]: string}
}

const CB = '() => {}'

const SAMPLES: Sample[] = [
  {
    name: 'plain direct call',
    label: 'BOTH RESOLVE',
    show: `shopify.intercept('beforecheckout', cb)`,
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nshopify.intercept('beforecheckout', ${CB})\n`,
    },
  },
  {
    name: 'same-file destructure',
    label: 'simple WARNS, complex RESOLVES',
    show: `const {intercept} = shopify\nintercept('beforediscount', cb)`,
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nconst {intercept} = shopify\nintercept('beforediscount', ${CB})\n`,
    },
  },
  {
    name: 'object alias then member call',
    label: 'simple WARNS, complex RESOLVES',
    show: `const s = shopify\ns.intercept('beforeexchange', cb)`,
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nconst s = shopify\ns.intercept('beforeexchange', ${CB})\n`,
    },
  },
  {
    name: 'cross-file re-exported reference',
    label: 'simple WARNS, complex RESOLVES',
    show: `// dep.ts\nexport const block = shopify.intercept\n// index.ts\nblock('beforecancel', cb)`,
    entry: 'index.ts',
    files: {
      'dep.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nexport const block = shopify.intercept\n`,
      'index.ts': `import {block} from './dep.js'\nblock('beforecancel', ${CB})\n`,
    },
  },
  {
    name: 'alias chain',
    label: 'simple WARNS (chain closed), complex RESOLVES',
    show: `const a = shopify\nconst b = a\nb.intercept('beforecapture', cb)`,
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nconst a = shopify\nconst b = a\nb.intercept('beforecapture', ${CB})\n`,
    },
  },
  {
    name: 'dynamic event argument (variable)',
    label: 'BOTH UNRESOLVED (dynamic) — simple WARNS',
    show: `const evt = 'beforetax'\nshopify.intercept(evt, cb)`,
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nconst evt = 'beforetax'\nshopify.intercept(evt, ${CB})\n`,
    },
  },
  {
    name: 'const-folded event name',
    label: 'COMPLEX ALSO FAILS (no constant folding) — simple WARNS',
    show: `const E = 'beforeshipping'\nshopify.intercept(E, cb)`,
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nconst E = 'beforeshipping'\nshopify.intercept(E, ${CB})\n`,
    },
  },
  {
    name: 'higher-order passing',
    label: 'COMPLEX ALSO FAILS (silent miss on HOF) — simple WARNS',
    show: `function register(fn) { fn('beforepayment', cb) }\nregister(shopify.intercept)`,
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nfunction register(fn: typeof shopify.intercept) {\n  fn('beforepayment', ${CB})\n}\nregister(shopify.intercept)\n`,
    },
  },
  {
    name: 'stored in object then called',
    label: 'COMPLEX ALSO FAILS (silent miss via object storage) — simple WARNS',
    show: `const m = {i: shopify.intercept}\nm.i('beforerefund', cb)`,
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nconst m = {i: shopify.intercept}\nm.i('beforerefund', ${CB})\n`,
    },
  },
]

function writeSample(sample: Sample): string {
  const dir = mkdtempSync(join(tmpdir(), 'pos-intercept-report-'))
  for (const [filename, content] of Object.entries(sample.files)) {
    const filePath = join(dir, filename)
    mkdirSync(dirname(filePath), {recursive: true})
    writeFileSync(filePath, content)
  }
  return join(dir, sample.entry)
}

type Mark = '✅' | '🟠' | '❌'

/** ✅ resolved · 🟠 surfaced/warned but not resolved · ❌ silent miss. */
function symbolFor(resolved: boolean, surfaced: boolean): Mark {
  if (resolved) return '✅'
  if (surfaced) return '🟠'
  return '❌'
}

function indent(text: string): string {
  return text
    .replace(/\n+$/, '')
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
}

interface Tally {
  '✅': number
  '🟠': number
  '❌': number
}

async function reportOne(
  heading: string,
  entryPath: string,
  code: string | undefined,
  tally: {simple: Tally; complex: Tally},
): Promise<void> {
  const [simple, complex] = await Promise.all([detectPosInterceptsSimple(entryPath), detectPosIntercepts(entryPath)])

  const simpleSymbol = symbolFor(simple.events.length > 0, simple.warnings.length > 0)
  const complexSymbol = symbolFor(complex.events.length > 0, complex.unresolved.length > 0)
  tally.simple[simpleSymbol]++
  tally.complex[complexSymbol]++

  const lines: string[] = []
  lines.push(heading)
  if (code !== undefined) lines.push(indent(code))
  lines.push(`    SIMPLE ${simpleSymbol}    COMPLEX ${complexSymbol}`)
  lines.push('')
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'))
}

test('POS intercept detector report (simple vs complex)', async () => {
  const overridePath = process.env.REPORT_PATH
  const tally = {
    simple: {'✅': 0, '🟠': 0, '❌': 0},
    complex: {'✅': 0, '🟠': 0, '❌': 0},
  }
  // eslint-disable-next-line no-console
  console.log(
    `\n\nPOS INTERCEPT DETECTOR REPORT — simple (safe-simplest) vs complex (alias-resolving)\n` +
      `✅ resolved · 🟠 not resolved but surfaced/warned · ❌ silent miss (returned nothing)\n`,
  )

  if (overridePath) {
    await reportOne(`FILE: ${overridePath}`, overridePath, undefined, tally)
  } else {
    for (let index = 0; index < SAMPLES.length; index++) {
      const sample = SAMPLES[index]!
      const entryPath = writeSample(sample)
      // eslint-disable-next-line no-await-in-loop
      await reportOne(`${index + 1}. ${sample.name}`, entryPath, sample.show, tally)
    }
  }

  const row = (t: Tally) => `✅ ${t['✅']}   🟠 ${t['🟠']}   ❌ ${t['❌']}`
  // eslint-disable-next-line no-console
  console.log(
    `${'─'.repeat(56)}\nTALLY\n  SIMPLE :  ${row(tally.simple)}\n  COMPLEX:  ${row(tally.complex)}\n` +
      `${'─'.repeat(56)}\nSimple has ZERO ❌ (never a silent miss); complex trades some 🟠/❌\nfor silent derivation of the alias cases.\n`,
  )
})
