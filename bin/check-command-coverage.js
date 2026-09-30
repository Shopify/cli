import {createHash} from 'node:crypto'
import {readFile, realpath} from 'node:fs/promises'
import {isAbsolute, relative, resolve, sep} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const metrics = ['lines', 'branches', 'functions']

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
}

function relativeFile(path, root) {
  const absolute = path.startsWith('file:') ? fileURLToPath(path) : resolve(root, path)
  const result = relative(root, absolute).split(sep).join('/')
  return !result || result === '..' || result.startsWith('../') || isAbsolute(result) ? undefined : result
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function readCounts(value, label) {
  requireObject(value, label)
  return Object.fromEntries(
    metrics.map((metric) => {
      const counts = value[metric]
      requireObject(counts, `${label}.${metric}`)
      const {total, covered} = counts
      if (
        !Number.isSafeInteger(total) ||
        total < 0 ||
        !Number.isSafeInteger(covered) ||
        covered < 0 ||
        covered > total
      ) {
        throw new Error(`${label}.${metric} needs integer counts with 0 <= covered <= total`)
      }
      return [metric, {total, covered}]
    }),
  )
}

function measure(counts, thresholds) {
  return Object.fromEntries(
    metrics.map((metric) => {
      const {total, covered} = counts[metric]
      return [
        metric,
        {
          total,
          covered,
          pct: total === 0 ? null : (covered * 100) / total,
          target: thresholds[metric],
          // No executable items is not 100%; keep it explicitly not applicable.
          passed: total === 0 ? null : covered * 100 >= thresholds[metric] * total,
        },
      ]
    }),
  )
}

/** Check scoped source coverage counts; the caller must verify report/build provenance. */
export async function checkCoverage(scope, summary, repository = process.cwd()) {
  requireObject(scope, 'Scope')
  requireObject(scope.thresholds, 'Scope thresholds')
  if (Object.keys(scope.thresholds).some((name) => !metrics.includes(name))) {
    throw new Error('Supported thresholds are lines, branches, and functions')
  }
  for (const metric of metrics) {
    const target = scope.thresholds[metric]
    if (typeof target !== 'number' || !Number.isFinite(target) || target < 0 || target > 100) {
      throw new Error(`Threshold ${metric} must be a number from 0 to 100`)
    }
  }
  if (!Array.isArray(scope.files) || scope.files.length === 0) throw new Error('Scope needs a nonempty files array')
  const root = await realpath(repository)
  const files = scope.files
    .map((path) => {
      if (typeof path !== 'string' || isAbsolute(path) || path.startsWith('file:')) {
        throw new Error('Scope files must be repository-relative paths')
      }
      const file = relativeFile(path, root)
      if (
        !file ||
        !/\.(?:[cm]?js|[cm]?ts|tsx)$/.test(file) ||
        /[*?[\]]/.test(file) ||
        /(?:^|\/)(?:node_modules|dist|test|tests|fixtures|__tests__)(?:\/|$)|\.(?:test|spec|d)\.[cm]?[jt]sx?$/.test(
          file,
        )
      ) {
        throw new Error(`Scope must name individual production source files: ${path}`)
      }
      return file
    })
    .sort()
  if (new Set(files).size !== files.length) throw new Error('Scope contains duplicate source paths')

  requireObject(summary, 'Coverage summary')
  if (Array.isArray(summary.result)) throw new Error('Raw V8 coverage is not source-mapped Istanbul coverage')
  readCounts(summary.total, 'Coverage summary total')
  const reports = new Map()
  for (const [path, value] of Object.entries(summary)) {
    if (path === 'total') continue
    const file = relativeFile(path, root)
    if (!files.includes(file)) continue
    if (reports.has(file)) throw new Error(`Coverage contains duplicate paths for ${file}`)
    reports.set(file, readCounts(value, file))
  }

  const failures = []
  const results = []
  const totals = Object.fromEntries(metrics.map((metric) => [metric, {total: 0, covered: 0}]))
  for (const file of files) {
    const sourcePath = await realpath(resolve(root, file))
    if (!relativeFile(sourcePath, root)) throw new Error(`Source resolves outside the repository: ${file}`)
    const sourceHash = hash(await readFile(sourcePath))
    const counts = reports.get(file)
    if (!counts) {
      failures.push(`Missing mapped coverage for ${file}`)
      results.push({file, sourceHash, metrics: null})
      continue
    }
    if (counts.lines.total === 0) failures.push(`No executable lines reported for ${file}; verify mapping/scope`)
    const measured = measure(counts, scope.thresholds)
    results.push({file, sourceHash, metrics: measured})
    for (const metric of metrics) {
      totals[metric].total += counts[metric].total
      totals[metric].covered += counts[metric].covered
      if (measured[metric].passed === false) failures.push(`${file}: ${metric} below ${scope.thresholds[metric]}%`)
    }
  }
  const aggregate = results.some((result) => result.metrics === null) ? null : measure(totals, scope.thresholds)
  if (aggregate) {
    for (const metric of metrics) {
      if (aggregate[metric].passed === false) failures.push(`Aggregate ${metric} below ${scope.thresholds[metric]}%`)
    }
  }
  return {
    passed: failures.length === 0,
    scopeHash: hash(JSON.stringify({files, thresholds: metrics.map((metric) => [metric, scope.thresholds[metric]])})),
    files: results,
    aggregate,
    failures,
  }
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      const nextStep = label === 'Coverage summary' ? ' Run `pnpm test:commands:coverage` to generate it.' : ''
      throw new Error(`${label} not found: ${path}.${nextStep}`)
    }
    throw error
  }
}

async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: pnpm test:commands:coverage:check <scope.json> <coverage-summary.json> [repository-root]')
    return
  }
  if (args.length < 2 || args.length > 3)
    throw new Error('Expected scope.json, coverage-summary.json, and optional repository root')
  const scope = await readJson(args[0], 'Coverage scope')
  const summary = await readJson(args[1], 'Coverage summary')
  const result = await checkCoverage(scope, summary, args[2])
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.passed ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message)
    process.exitCode = 2
  })
}
