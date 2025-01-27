export interface AppLogsSubscribeVariables {
  shopIds: string[]
  apiKey: string
  token: string
}

export interface AppLogsSubscribeResponse {
  appLogsSubscribe: {
    success: boolean
    errors?: string[]
    jwtToken: string
  }
}
