#!/usr/bin/env node
/**
 * Standalone entry point for the Flow CLI.
 *
 * Parses argv directly instead of going through oclif's plugin discovery /
 * manifest reading, so the dist/ output works without a plugin manifest.
 */
import COMMANDS from './index.js'
import {Config} from '@oclif/core'
import {dirname} from '@shopify/cli-kit/node/path'
import {arch, homedir, platform, userInfo} from 'node:os'
import {fileURLToPath} from 'node:url'

const VERSION = '0.0.1'
const BIN = 'flow'
const NAME = '@shopify/flow-cli'

// ── argv routing ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)

if (argv.length === 0 || argv[0] === 'help') {
  printHelp()
  process.exit(0)
}

if (argv[0] === '--version' || argv[0] === '-v') {
  process.stdout.write(`${BIN}/${VERSION}\n`)
  process.exit(0)
}

// Extract up to 2 non-flag tokens as command namespace + subcommand.
const tokens: string[] = []
let tokenEnd = 0
while (tokenEnd < argv.length && !argv[tokenEnd]!.startsWith('-') && tokens.length < 2) {
  tokens.push(argv[tokenEnd]!)
  tokenEnd++
}
const cmdArgv = argv.slice(tokenEnd)

// Try "ns:sub" first (e.g. "workflow list"), then bare "cmd" (e.g. "init").
let commandId = tokens.join(':')
if (!(commandId in COMMANDS) && tokens.length > 1) {
  commandId = tokens[0] ?? ''
  cmdArgv.unshift(tokens[1]!)
}

const CommandClass = COMMANDS[commandId as keyof typeof COMMANDS]
if (!CommandClass) {
  process.stderr.write(`Unknown command: ${tokens.join(' ')}\n\n`)
  printHelp()
  process.exit(1)
}

// ── minimal oclif Config ──────────────────────────────────────────────────────
//
// oclif's Command.run() needs a Config object for flag parsing and lifecycle
// hooks. We build one without any filesystem reads so this file stays
// bundle-friendly: all data is inlined at compile time.

const root = dirname(fileURLToPath(import.meta.url))

// Config constructor just stores options — properties are set manually here
// instead of calling Config.load() which reads package.json / oclif.manifest.json.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config = new Config({root}) as any

config.bin = BIN
config.binAliases = []
config.binPath = undefined
config.name = NAME
config.version = VERSION
config.root = root
config.channel = 'stable'
config.valid = true
config.arch = arch()
config.platform = platform()
config.windows = platform() === 'win32'
config.shell = userInfo().shell?.split('/').pop() ?? 'unknown'
config.home = homedir()
config.dirname = NAME
config.cacheDir = `${homedir()}/.cache/${NAME}`
config.configDir = `${homedir()}/.config/${NAME}`
config.dataDir = `${homedir()}/.local/share/${NAME}`
config.userAgent = `${BIN}/${VERSION} ${platform()}-${arch()} node-${process.version}`
config.topicSeparator = ':'
config.flexibleTaxonomy = false
config.isSingleCommandCLI = false
config.plugins = new Map()
config._commands = new Map()
config._topics = new Map()
config.pjson = {
  name: NAME,
  version: VERSION,
  description: 'Standalone Shopify Flow CLI',
  keywords: [],
  files: [],
  dependencies: {},
  devDependencies: {},
  engines: {node: '>=18.20.0'},
  oclif: {
    bin: BIN,
    commands: {},
    topics: {},
    plugins: [],
    hooks: {},
  },
}

// Flow CLI has no lifecycle hooks — stub runHook to be a no-op.
config.runHook = async () => ({successes: [], failures: []})

// Defer to the next event-loop tick so Rollup's single-file bundle can finish
// all module-level var initializations (which follow this entry-point block in
// the output) before the command runs.
setImmediate(async () => {
  try {
    await CommandClass.run(cmdArgv, config)
  } catch (error: unknown) {
    // oclif throws ExitError with code 0 after displaying help — treat it as a clean exit.
    const exit = (error as {oclif?: {exit?: number}})?.oclif?.exit
    if (exit === 0) process.exit(0)
    throw error
  }
})

// ── help ──────────────────────────────────────────────────────────────────────

function printHelp(): void {
  const commands = Object.keys(COMMANDS).sort()
  process.stdout.write(
    [
      `${BIN} — Shopify Flow CLI  (v${VERSION})`,
      '',
      'Usage:',
      `  ${BIN} <command> [args] [flags]`,
      '',
      'Commands:',
      ...commands.map((id) => `  ${id}`),
      '',
    ].join('\n'),
  )
}
