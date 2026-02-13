import {execa} from 'execa'
import type {McpServerConfig} from './config.js'

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

const LONG_RUNNING_COMMANDS = ['theme dev', 'app dev']

export function isLongRunningCommand(args: string[]): string | undefined {
  const command = args.join(' ')
  return LONG_RUNNING_COMMANDS.find((lr) => command.startsWith(lr))
}

export async function execShopify(
  config: McpServerConfig,
  args: string[],
  options?: {timeout?: number},
): Promise<ExecResult> {
  const env = buildEnv(config)

  try {
    const result = await execa(config.shopifyCliPath, [...args, '--no-color'], {
      reject: false,
      timeout: options?.timeout ?? config.timeout,
      env,
    })

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    }
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {
        stdout: '',
        stderr: `Shopify CLI not found at "${config.shopifyCliPath}". Install it with: npm install -g @shopify/cli`,
        exitCode: 1,
      }
    }
    throw error
  }
}

export function buildEnv(config: McpServerConfig): {[key: string]: string} {
  const env: {[key: string]: string} = {
    NO_COLOR: '1',
  }
  if (config.store) {
    env.SHOPIFY_FLAG_STORE = config.store
  }
  if (config.themeAccessPassword) {
    env.SHOPIFY_CLI_THEME_TOKEN = config.themeAccessPassword
  }
  if (config.path) {
    env.SHOPIFY_FLAG_PATH = config.path
  }
  return env
}

const AUTH_ERROR_PATTERNS = [
  'you are not logged in',
  'authentication required',
  'shopify auth login',
  'session has expired',
  'invalid credentials',
  'login to continue',
  'not authenticated',
]

export function isAuthError(output: string): boolean {
  const lower = output.toLowerCase()
  return AUTH_ERROR_PATTERNS.some((pattern) => lower.includes(pattern))
}

export function formatToolResult(result: ExecResult): {content: {type: 'text'; text: string}[]; isError?: boolean} {
  if (result.exitCode !== 0) {
    const errorText = result.stderr || result.stdout
    if (isAuthError(errorText)) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Authentication error: ${errorText}\n\nNot authenticated. Use the shopify_auth_login tool to open the browser and log in.`,
          },
        ],
      }
    }
    return {
      isError: true,
      content: [{type: 'text', text: errorText || `Command failed with exit code ${result.exitCode}`}],
    }
  }

  const output = result.stdout.trim()
  if (!output) {
    return {content: [{type: 'text', text: 'Command completed successfully.'}]}
  }

  if (output.startsWith('{') || output.startsWith('[')) {
    try {
      const parsed = JSON.parse(output)
      return {content: [{type: 'text', text: JSON.stringify(parsed, null, 2)}]}
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        return {content: [{type: 'text', text: output}]}
      }
      throw error
    }
  }

  return {content: [{type: 'text', text: output}]}
}
