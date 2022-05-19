import {QueryClient, QueryClientProvider, QueryCache, MutationCache} from 'react-query'

export function GraphQLProvider({children}) {
  const client = new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
  })

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
