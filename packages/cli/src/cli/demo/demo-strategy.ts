export interface DemoContext {
  [key: string]: unknown
}

export interface DemoStrategy {
  beforeCommand?: () => unknown
  afterCommand?: () => unknown
  promptAugmentations?: (context?: DemoContext) => {
    [key: string]: {
      beforePrompt?: () => Promise<void>
      validate?: (value: string) => string | undefined
    }
  }
}
