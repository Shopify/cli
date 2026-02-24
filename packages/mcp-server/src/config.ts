export interface McpServerConfig {
  shopifyCliPath: string
  store?: string
  themeAccessPassword?: string
  path?: string
  timeout: number
}

export function resolveConfig(overrides?: Partial<McpServerConfig>): McpServerConfig {
  return {
    shopifyCliPath: overrides?.shopifyCliPath ?? process.env.SHOPIFY_CLI_PATH ?? 'shopify',
    store: overrides?.store ?? process.env.SHOPIFY_FLAG_STORE,
    themeAccessPassword: overrides?.themeAccessPassword ?? process.env.SHOPIFY_CLI_THEME_TOKEN,
    path: overrides?.path ?? process.env.SHOPIFY_FLAG_PATH,
    timeout: overrides?.timeout ?? (Number(process.env.SHOPIFY_MCP_TIMEOUT) || 120_000),
  }
}
