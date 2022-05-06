import {gql} from 'graphql-request'

export const GetAppFunctionsQuery = gql`
  query GetAppScripts($appKey: String!, $extensionPointName: ExtensionPointName!) {
    appScripts(appKeys: [$appKey], extensionPointName: $extensionPointName) {
      uuid
      title
    }
  }
`
