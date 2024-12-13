export interface DemoContext {
  [key: string]: unknown
}

export interface DemoPromptAugmentation {
  beforePrompt?: () => Promise<void>
  validate?: (value: string) => string | undefined
}

export interface DemoStrategy {
  beforeCommand?: () => unknown
  afterCommand?: () => unknown
  promptAugmentations?: (context?: DemoContext) => {
    [key: string]: DemoPromptAugmentation
  }
}
