/*
 * Reader/writer for `flow.toml` — the per-project IaC config file.
 *
 * Shape:
 *   store = "shop.myshopify.com"
 *
 *   [workflows]
 *   dir = "workflows"
 *
 * Lifecycle commands fall back to this file when --store and --workflows-dir
 * aren't passed. `shopify flow init` writes the initial file.
 */
import {formatZodErrors} from './zod-errors.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {cwd, dirname, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'
import {TomlFile, TomlFileError} from '@shopify/cli-kit/node/toml/toml-file'

export const FLOW_CONFIG_FILENAME = 'flow.toml'
const DEFAULT_WORKFLOWS_DIR = 'workflows'

const FlowTomlSchema = zod
  .object({
    store: zod.string().min(1, 'store is required'),
    workflows: zod
      .object({
        dir: zod.string().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export interface FlowProjectConfig {
  store: string
  workflowsDir: string
  configPath: string
  rootDir: string
}

export async function findConfigFile(startDir = cwd()): Promise<string | undefined> {
  let dir = resolvePath(startDir)
  while (true) {
    const candidate = joinPath(dir, FLOW_CONFIG_FILENAME)
    if (await fileExists(candidate)) return candidate

    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

export async function loadConfig(startDir = cwd()): Promise<FlowProjectConfig | undefined> {
  const path = await findConfigFile(startDir)
  if (!path) return undefined

  let file: TomlFile
  try {
    file = await TomlFile.read(path)
  } catch (error) {
    if (error instanceof TomlFileError) throw new AbortError(`Failed to parse ${path}: ${error.message}`)
    throw error
  }

  const parsed = FlowTomlSchema.safeParse(file.content)
  if (!parsed.success) {
    throw new AbortError(`${path} is malformed.`, formatZodErrors(parsed.error))
  }

  return {
    store: parsed.data.store,
    workflowsDir: parsed.data.workflows?.dir ?? DEFAULT_WORKFLOWS_DIR,
    configPath: path,
    rootDir: dirname(path),
  }
}

export async function requireConfig(startDir = cwd()): Promise<FlowProjectConfig> {
  const config = await loadConfig(startDir)
  if (!config) {
    throw new AbortError(
      `No ${FLOW_CONFIG_FILENAME} found in this directory or any ancestor.`,
      'Run `shopify flow init` to create one.',
    )
  }
  return config
}

export interface WriteConfigInput {
  dir: string
  store: string
  workflowsDir?: string
  force?: boolean
}

export async function writeConfig(input: WriteConfigInput): Promise<string> {
  const path = joinPath(input.dir, FLOW_CONFIG_FILENAME)
  if ((await fileExists(path)) && !input.force) {
    throw new AbortError(`${path} already exists.`, 'Pass --force to overwrite, or edit the file directly.')
  }

  const file = new TomlFile(path, {})
  await file.replace({
    store: input.store,
    workflows: {
      dir: input.workflowsDir ?? DEFAULT_WORKFLOWS_DIR,
    },
  })
  return path
}

export function workflowsDirAbsolute(config: FlowProjectConfig): string {
  return resolvePath(config.rootDir, config.workflowsDir)
}
