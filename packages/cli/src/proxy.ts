export async function withFetchProxy<T>(run: () => Promise<T>, env: NodeJS.ProcessEnv = process.env): Promise<T> {
  if (!env.SHOPIFY_HTTP_PROXY && !env.SHOPIFY_HTTPS_PROXY) return run()

  const {withProxyAgent} = await import('./proxy-agent.js')
  return withProxyAgent(run, env)
}
