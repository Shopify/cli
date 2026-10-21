import {EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher} from 'undici'

export async function withProxyAgent<T>(run: () => Promise<T>, env: NodeJS.ProcessEnv): Promise<T> {
  const previousDispatcher = getGlobalDispatcher()
  const dispatcher = new EnvHttpProxyAgent({
    // Empty values prevent Undici from using unprefixed proxy variables.
    httpProxy: env.SHOPIFY_HTTP_PROXY ?? '',
    httpsProxy: env.SHOPIFY_HTTPS_PROXY ?? '',
    noProxy: env.SHOPIFY_NO_PROXY ?? '',
    connectTimeout: 60000,
  })
  setGlobalDispatcher(dispatcher)
  try {
    return await run()
  } finally {
    setGlobalDispatcher(previousDispatcher)
    await dispatcher.close()
  }
}
