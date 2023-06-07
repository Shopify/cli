import {gql} from 'graphql-request'

export type BetasSupported = 'app_unified_deployment'

export const SetBetaFlagQuery = gql`
  mutation setBetaFlag($input: SetBetaFlagInput!) {
    setBetaFlag(input: $input) {
      userErrors {
        message
        field
      }
    }
  }
`

export interface SetBetaFlagVariables {
  input: {
    apiKey: string
    betaName: BetasSupported
    enabled: boolean
  }
}

export interface SetBetaFlagSchema {
  setBetaFlag: {
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
