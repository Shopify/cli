import {fetch} from './http.js'
import {debug, content, token} from './output.js'
import {JsonMap} from './json.js'
import {DeepRequired} from './typing/deep-required.js'

const url = 'https://monorail-edge.shopifysvc.com/v1/produce'

type Optional<T> = T | null

// This is the topic name of the main event we log to Monorail, the command tracker
export const MONORAIL_COMMAND_TOPIC = 'app_cli3_command/1.1' as const

export interface Schemas {
  [MONORAIL_COMMAND_TOPIC]: {
    sensitive: {args: string; error_message?: Optional<string>; metadata?: Optional<string>}
    public: {
      partner_id?: Optional<number>
      command: string
      project_type?: Optional<string>
      time_start: number
      time_end: number
      total_time: number
      success: boolean
      api_key?: Optional<string>
      cli_version: string
      uname: string
      ruby_version: string
      node_version: string
      is_employee: boolean

      // Any and all commands
      cmd_all_alias_used?: Optional<string>
      cmd_all_launcher?: Optional<string>
      cmd_all_path_override?: Optional<boolean>
      cmd_all_path_override_hash?: Optional<string>
      cmd_all_plugin?: Optional<string>
      cmd_all_topic?: Optional<string>
      cmd_all_verbose?: Optional<boolean>

      // Any extension related command
      cmd_extensions_binary_from_source?: Optional<boolean>

      // Scaffolding related commands
      cmd_scaffold_required_auth?: Optional<boolean>
      cmd_scaffold_template_custom?: Optional<boolean>
      cmd_scaffold_template_flavor?: Optional<string>
      cmd_scaffold_type?: Optional<string>
      cmd_scaffold_type_category?: Optional<string>
      cmd_scaffold_type_gated?: Optional<boolean>
      cmd_scaffold_type_owner?: Optional<string>
      cmd_scaffold_used_prompts_for_type?: Optional<boolean>

      // App setup
      app_extensions_any?: Optional<boolean>
      app_extensions_breakdown?: Optional<string>
      app_extensions_count?: Optional<number>
      app_extensions_custom_layout?: Optional<boolean>
      app_extensions_function_any?: Optional<boolean>
      app_extensions_function_count?: Optional<number>
      app_extensions_function_custom_layout?: Optional<boolean>
      app_extensions_theme_any?: Optional<boolean>
      app_extensions_theme_count?: Optional<number>
      app_extensions_theme_custom_layout?: Optional<boolean>
      app_extensions_ui_any?: Optional<boolean>
      app_extensions_ui_count?: Optional<number>
      app_extensions_ui_custom_layout?: Optional<boolean>
      app_name_hash?: Optional<string>
      app_path_hash?: Optional<string>
      app_scopes?: Optional<string>
      app_web_backend_any?: Optional<boolean>
      app_web_backend_count?: Optional<number>
      app_web_custom_layout?: Optional<boolean>
      app_web_frontend_any?: Optional<boolean>
      app_web_frontend_count?: Optional<number>

      // Environment
      env_ci?: Optional<boolean>
      env_ci_platform?: Optional<string>
      env_plugin_installed_any_custom?: Optional<boolean>
      env_plugin_installed_shopify?: Optional<string>
      env_shell?: Optional<string>
      env_web_ide?: Optional<string>
    }
  }
  [schemaId: string]: {sensitive: JsonMap; public: JsonMap}
}

// In reality, we're normally most interested in just this from Schemas, so export it for ease of use.
// The monorail schema itself has lots of optional values as it must be backwards-compatible. For our schema we want mandatory values instead.
export type MonorailEventPublic = DeepRequired<Schemas[typeof MONORAIL_COMMAND_TOPIC]['public']>
export type MonorailEventSensitive = Schemas[typeof MONORAIL_COMMAND_TOPIC]['sensitive']

type MonorailResult = {type: 'ok'} | {type: 'error'; message: string}

export async function publishEvent<TSchemaId extends keyof Schemas, TPayload extends Schemas[TSchemaId]>(
  schemaId: TSchemaId,
  publicData: TPayload['public'],
  sensitiveData: TPayload['sensitive'],
): Promise<MonorailResult> {
  try {
    const currentTime = new Date().getTime()
    const payload = {...publicData, ...sensitiveData}
    const body = JSON.stringify({schema_id: schemaId, payload})
    const headers = buildHeaders(currentTime)

    const response = await fetch(url, {method: 'POST', body, headers})

    if (response.status === 200) {
      debug(content`Analytics event sent: ${token.json(payload)}`)
      return {type: 'ok'}
    } else {
      debug(`Failed to report usage analytics: ${response.statusText}`)
      return {type: 'error', message: response.statusText}
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    let message = 'Failed to report usage analytics'
    if (error instanceof Error) {
      message = message.concat(`: ${error.message}`)
    }
    debug(message)
    return {type: 'error', message}
  }
}

const buildHeaders = (currentTime: number) => {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Monorail-Edge-Event-Created-At-Ms': currentTime.toString(),
    'X-Monorail-Edge-Event-Sent-At-Ms': currentTime.toString(),
  }
}
