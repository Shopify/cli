import {AbortError} from '@shopify/cli-kit/node/error'

export type StoreSelectionSource =
  | 'explicit-environment'
  | 'explicit-store'
  | 'environment-variable'
  | 'default'
  | 'sole-store'
  | 'bootstrap'

export interface TrustedThemeEnvironment {
  name: string
  store: string
}

export type ThemeProjectTrust =
  | {state: 'unconfigured'; path?: string; themePath: string}
  | {state: 'configured'; path: string; themePath: string; environments: TrustedThemeEnvironment[]}

export interface AirlockTarget {
  environment?: string
  store: string
  source: StoreSelectionSource
  implicit: boolean
}

export class ThemeAirlockError extends AbortError {
  readonly targets: AirlockTarget[]
  readonly reason: string

  constructor(message: string, reason: string, targets: AirlockTarget[] = []) {
    super(message, 'No files were uploaded.')
    this.name = 'ThemeAirlockError'
    this.targets = targets
    this.reason = reason
  }
}
