/**
 * Function — validates async encode with file I/O, UUID generation, field restructuring.
 */

import {AppModule, EncodeContext} from '../app-module.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {randomUUID} from '@shopify/cli-kit/node/crypto'

interface FunctionToml {
  name: string
  type: string
  description?: string
  api_version: string
  build?: {command?: string; path?: string; watch?: string | string[]; wasm_opt?: boolean}
  configuration_ui?: boolean
  ui?: {
    enable_create?: boolean
    paths?: {create: string; details: string}
    handle?: string
  }
  input?: {variables?: {namespace: string; key: string}}
  targeting?: {target: string; input_query?: string; export?: string}[]
  [key: string]: unknown
}

interface FunctionContract {
  title: string
  module_id: string
  description?: string
  app_key: string
  api_type?: string
  api_version: string
  input_query?: string
  input_query_variables?: {single_json_metafield: {namespace: string; key: string}}
  ui?: {
    app_bridge?: {details_path: string; create_path: string}
    ui_extension_handle?: string
  }
  enable_creation_ui: boolean
  localization: unknown
  targets?: {handle: string; export?: string; input_query?: string}[]
}

async function readInputQuery(path: string): Promise<string> {
  if (await fileExists(path)) {
    return readFile(path)
  } else {
    throw new AbortError(
      `No input query file at ${path}.`,
      `Create the file or remove the line referencing it in the extension's TOML.`,
    )
  }
}

export class FunctionModule extends AppModule<FunctionToml, FunctionContract> {
  constructor() {
    super({identifier: 'function', uidStrategy: 'uuid'})
  }

  async encode(toml: FunctionToml, context: EncodeContext): Promise<FunctionContract> {
    // Read top-level input query
    let inputQuery: string | undefined
    const inputQueryPath = joinPath(context.directory, 'input.graphql')
    if (await fileExists(inputQueryPath)) {
      inputQuery = await readFile(inputQueryPath)
    }

    // Read per-target input queries
    const targets =
      toml.targeting &&
      (await Promise.all(
        toml.targeting.map(async (targeting) => {
          let targetInputQuery: string | undefined
          if (targeting.input_query) {
            targetInputQuery = await readInputQuery(joinPath(context.directory, targeting.input_query))
          }
          return {handle: targeting.target, export: targeting.export, input_query: targetInputQuery}
        }),
      ))

    // Build UI config
    let ui: FunctionContract['ui'] | undefined
    if (toml.ui?.paths) {
      ui = {
        app_bridge: {
          details_path: toml.ui.paths.details,
          create_path: toml.ui.paths.create,
        },
      }
    }
    if (toml.ui?.handle !== undefined) {
      ui = {...ui, ui_extension_handle: toml.ui.handle}
    }

    return {
      title: toml.name,
      module_id: randomUUID(),
      description: toml.description,
      app_key: context.apiKey,
      api_type: toml.type === 'function' ? undefined : toml.type,
      api_version: toml.api_version,
      input_query: inputQuery,
      input_query_variables: toml.input?.variables ? {single_json_metafield: toml.input.variables} : undefined,
      ui,
      enable_creation_ui: toml.ui?.enable_create ?? true,
      localization: await loadLocalesConfig(context.directory, 'function'),
      targets,
    }
  }
}

export const functionModule = new FunctionModule()
