export interface LogsOptions {
  apiKey?: string
  store?: string[]
  path?: string
  source?: string
  status?: string
}

export async function logs(commandOptions: LogsOptions) {
  const {apiKey, store, path, source, status} = commandOptions
  console.log('starting the app log command', {
    apiKey,
    store,
    path,
    source,
    status,
  })
}
