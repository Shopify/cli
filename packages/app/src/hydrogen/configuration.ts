export interface UserConfiguration {
  name: string
  scopes: string[]
}

export type UserConfigurationEnvironment = 'development' | 'production'

export interface UserConfigurationOptions {
  environment: UserConfigurationEnvironment
}

export function defineHydrogenApp(
  config: (options: UserConfigurationOptions) => Promise<UserConfiguration> | UserConfiguration,
) {
  return config
}
