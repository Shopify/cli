export const CurrentUserAccountQuery = `#graphql
  query currentUserAccount {
    currentUserAccount {
      email
      organizations(first: 100) {
        edges {
          node {
            id
            name
            categories(handles: STORES) {
              destinations(first: 100) {
                edges {
                  node {
                    ...destinationFields
                  }
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
      orphanDestinations {
        categories(handles: STORES) {
          destinations(first: 100) {
            edges {
              node {
                ...destinationFields
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
    }
  }

  fragment destinationFields on Destination {
    id
    name
    status
    publicId
    handle
    shortName
    webUrl
  }
`
