import {spawn} from 'node:child_process'
import {mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises'
import {basename, dirname, isAbsolute, relative, resolve} from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath, pathToFileURL} from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

function usage() {
  return `Usage: pnpm test:commands:coverage [options]

Run command tests, map spawned-CLI V8 coverage to TypeScript sources, and check thresholds.

Options:
  --scope <path>      Coverage scope (default: test/app-info/coverage-scope.json)
  --test-file <path>  Test file relative to test/ (default: app-info.test.ts)
  --test-name <name>  Run only tests matching this name (useful for diagnostics)
  --output <path>     Directory below coverage/ (default: coverage/commands/app-info)
  --help              Show this help

The default command runs the complete app-info suite. A focused --test-name run is
for diagnosing the pipeline and must not be used as command-wide coverage evidence.`
}

export function parseArguments(args) {
  const options = {
    scope: 'test/app-info/coverage-scope.json',
    testFile: 'app-info.test.ts',
    output: 'coverage/commands/app-info',
    testName: undefined,
    help: false,
  }
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--help') {
      options.help = true
      continue
    }
    const key = {'--scope': 'scope', '--test-file': 'testFile', '--test-name': 'testName', '--output': 'output'}[
      argument
    ]
    if (!key) throw new Error(`Unknown option: ${argument}`)
    const value = args[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`${argument} needs a value`)
    options[key] = value
    index += 1
  }
  return options
}

function executable(packageName) {
  const packagePath = require.resolve(`${packageName}/package.json`)
  const packageJson = require(packagePath)
  const relativeBinary = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin[packageName]
  return resolve(dirname(packagePath), relativeBinary)
}

async function runNode(script, args, environment = process.env) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: repository,
    env: environment,
    stdio: 'inherit',
  })
  const result = await new Promise((_resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => _resolve({code, signal}))
  })
  if (result.signal) throw new Error(`${basename(script)} terminated with ${result.signal}`)
  return result.code ?? 1
}

async function findCoverageFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await findCoverageFiles(path)))
    else if (entry.isFile() && /^coverage-.*\.json$/.test(entry.name)) files.push(path)
  }
  return files
}

async function externalSourceMap(url) {
  if (!url.startsWith('file:')) return undefined
  const generatedPath = fileURLToPath(url)
  try {
    const [generatedSource, sourceMapText] = await Promise.all([
      readFile(generatedPath, 'utf8'),
      readFile(`${generatedPath}.map`, 'utf8'),
    ])
    const data = JSON.parse(sourceMapText)
    data.sources = data.sources.map((source) => {
      if (source.startsWith('file:')) return source
      return pathToFileURL(resolve(dirname(generatedPath), data.sourceRoot ?? '', source)).href
    })
    data.sourceRoot = ''
    return {
      data,
      lineLengths: generatedSource.split(/\r?\n/).map((line) => line.length),
      url: null,
    }
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

export async function flattenCoverageFiles(rawDirectory, destination) {
  const files = await findCoverageFiles(rawDirectory)
  if (files.length === 0) throw new Error(`No V8 coverage files were written to ${rawDirectory}`)
  await mkdir(destination, {recursive: true})
  const sourceMapCache = {}
  for (const [index, source] of files.entries()) {
    const report = JSON.parse(await readFile(source, 'utf8'))
    delete report['source-map-cache']
    await writeFile(resolve(destination, `coverage-${String(index).padStart(6, '0')}.json`), JSON.stringify(report))
    for (const {url} of report.result) {
      if (sourceMapCache[url]) continue
      const sourceMap = await externalSourceMap(url)
      if (sourceMap) sourceMapCache[url] = sourceMap
    }
  }
  await writeFile(
    resolve(destination, 'source-map-cache.json'),
    JSON.stringify({result: [], timestamp: 0, 'source-map-cache': sourceMapCache}),
  )
  return files.length
}

function resolveFromRepository(path) {
  return isAbsolute(path) ? path : resolve(repository, path)
}

export function resolveOutputDirectory(path) {
  const coverageRoot = resolve(repository, 'coverage')
  const outputDirectory = resolveFromRepository(path)
  const offset = relative(coverageRoot, outputDirectory)
  if (!offset || isAbsolute(offset) || offset === '..' || offset.startsWith('../')) {
    throw new Error('Coverage output must be a directory below coverage/')
  }
  return outputDirectory
}

async function main(args) {
  const options = parseArguments(args)
  if (options.help) {
    console.log(usage())
    return 0
  }

  const scopePath = resolveFromRepository(options.scope)
  const testConfig = resolve(repository, 'test/vite.config.ts')
  const outputDirectory = resolveOutputDirectory(options.output)
  const rawDirectory = resolve(outputDirectory, 'raw')
  const flatDirectory = resolve(outputDirectory, '.c8-input')
  const reportDirectory = resolve(outputDirectory, 'report')
  const summaryPath = resolve(reportDirectory, 'coverage-summary.json')

  await readFile(scopePath, 'utf8')
  await rm(outputDirectory, {recursive: true, force: true})
  await mkdir(rawDirectory, {recursive: true})

  const testArguments = ['run', '--config', testConfig, options.testFile, '--reporter=dot']
  if (options.testName) testArguments.push('--testNamePattern', options.testName)

  console.log(`Running ${options.testFile} with spawned-CLI coverage...`)
  const testStatus = await runNode(executable('vitest'), testArguments, {
    ...process.env,
    SHOPIFY_CLI_SOURCE_COVERAGE: '1',
    SHOPIFY_TEST_COVERAGE_DIR: rawDirectory,
    SHOPIFY_TEST_COVERAGE_SCOPE: scopePath,
  })
  if (testStatus !== 0) {
    console.error(`Tests failed. Raw coverage remains at ${relative(repository, rawDirectory)}.`)
    return testStatus
  }

  const coverageFileCount = await flattenCoverageFiles(rawDirectory, flatDirectory)
  console.log(`Mapping ${coverageFileCount} spawned-process coverage files...`)
  const reportStatus = await runNode(executable('c8'), [
    'report',
    '--temp-directory',
    flatDirectory,
    '--reports-dir',
    reportDirectory,
    '--reporter',
    'json-summary',
    '--exclude-after-remap',
    '--merge-async',
  ])
  await rm(flatDirectory, {recursive: true, force: true})
  if (reportStatus !== 0) return reportStatus

  console.log(`Mapped summary: ${relative(repository, summaryPath)}`)
  console.log(`Raw V8 data: ${relative(repository, rawDirectory)}`)
  return runNode(resolve(repository, 'bin/check-command-coverage.js'), [scopePath, summaryPath, repository])
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode
    })
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 2
    })
}
