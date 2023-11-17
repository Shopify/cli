import {gql} from 'graphql-request'

export const DevSessionDeleteAppModulesMutation = gql`
  mutation devSessionDeleteAppModules($moduleUuidsToDelete: [String!]!) {
    devSessionDeleteAppModules(moduleUuidsToDelete: $moduleUuidsToDelete) {
      deletedUuids
    }
  }
`

export interface DevSessionDeleteAppModulesVariables {
  moduleUuidsToDelete: string[]
}

export interface DevSessionDeleteAppModulesSchema {
  deletedUuids: string[]
}
