import { useQuery } from "react-query";
import { GraphQLClient } from "graphql-request";

import { useAuthenticatedFetch } from "./useAuthenticatedFetch.js";

export const useShopifyQuery = ({ key, query, variables }) => {
  const authenticatedFetch = useAuthenticatedFetch();
  const graphQLClient = new GraphQLClient("/api/graphql", {
    fetch: authenticatedFetch,
  });

  return useQuery(key, async () => graphQLClient.rawRequest(query, variables));
};
