import {useExtensionServerContext} from './useExtensionServerContext.js'

export function useExtensionClient() {
  const {client} = useExtensionServerContext()
  return client
}
