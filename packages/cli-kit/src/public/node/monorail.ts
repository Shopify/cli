import {fetch} from './http.js'
import {JsonMap} from '../../private/common/json.js'
import {outputDebug, outputContent, outputToken} from '../../public/node/output.js'
import {DeepRequired} from '../common/ts/deep-required.js'

export {DeepRequired}

const url = 'https://monorail-edge.shopifysvc.com/v1/produce'

type Optional<T> = T | null

// This is the topic name of the main event we log to Monorail, the command tracker
export const MONORAIL_COMMAND_TOPIC = 'app_cli3_command/1.3' as const

export interface Schemas {
  [MONORAIL_COMMAND_TOPIC]: {
    sensitive: {
      args: string
      error_message?: Optional<string>
      app_name?: Optional<string>
      metadata?: Optional<string>
      store_fqdn?: Optional<string>
      cmd_all_environment_flags?: Optional<string>

      // Dev related commands
      cmd_dev_tunnel_custom?: Optional<string>

      // Environment
      env_plugin_installed_all?: Optional<string>
    }
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
      store_fqdn_hash?: Optional<string>

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

      // Used in several but not all commands
      cmd_app_dependency_installation_skipped?: Optional<boolean>
      cmd_app_reset_used?: Optional<boolean>

      // Dev related commands
      cmd_dev_tunnel_type?: Optional<string>
      cmd_dev_tunnel_custom_hash?: Optional<string>
      cmd_dev_urls_updated?: Optional<boolean>

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
      app_web_framework?: Optional<string>
      app_web_frontend_any?: Optional<boolean>
      app_web_frontend_count?: Optional<number>

      // Environment
      env_ci?: Optional<boolean>
      env_ci_platform?: Optional<string>
      env_device_id?: Optional<string>
      env_package_manager?: Optional<string>
      env_package_manager_workspaces?: Optional<boolean>
      env_plugin_installed_any_custom?: Optional<boolean>
      env_plugin_installed_shopify?: Optional<string>
      env_shell?: Optional<string>
      env_web_ide?: Optional<string>
      env_cloud?: Optional<string>
    }
  }
  [schemaId: string]: {sensitive: JsonMap; public: JsonMap}
}

// In reality, we're normally most interested in just this from Schemas, so export it for ease of use.
// The monorail schema itself has lots of optional values as it must be backwards-compatible. For our schema we want mandatory values instead.
export type MonorailEventPublic = DeepRequired<Schemas[typeof MONORAIL_COMMAND_TOPIC]['public']>
export type MonorailEventSensitive = Schemas[typeof MONORAIL_COMMAND_TOPIC]['sensitive']

type MonorailResult = {type: 'ok'} | {type: 'error'; message: string}

/**
 * Publishes an event to Monorail.
 *
 * @param schemaId - The schema ID of the event to publish.
 * @param publicData - The public data to publish.
 * @param sensitiveData - The sensitive data to publish.
 * @returns A result indicating whether the event was successfully published.
 */
export async function publishMonorailEvent<TSchemaId extends keyof Schemas, TPayload extends Schemas[TSchemaId]>(
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
      outputDebug(outputContent`Analytics event sent: ${outputToken.json(payload)}`)
      return {type: 'ok'}
    } else {
      outputDebug(`Failed to report usage analytics: ${response.statusText}`)
      return {type: 'error', message: response.statusText}
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    let message = 'Failed to report usage analytics'
    if (error instanceof Error) {
      message = message.concat(`: ${error.message}`)
    }
    outputDebug(message)
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
