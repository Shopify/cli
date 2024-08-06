import {gql} from 'graphql-request'

export function organizationBetaFlagsQuery(flags: string[]): string {
  return gql`
    query OrganizationBetaFlags($organizationId: OrganizationID!) {
      organization(organizationId: $organizationId) {
        id
        ${flags.map((flag) => `flag_${flag}: hasFeatureFlag(handle: "${flag}")`).join('\n        ')}
      }
    }`
}

export interface OrganizationBetaFlagsQueryVariables {
  organizationId: string
}

export interface OrganizationBetaFlagsQuerySchema {
  organization: {
    id: string
    [flag: `flag_${string}`]: boolean
  }
}
