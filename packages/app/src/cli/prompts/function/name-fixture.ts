import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

export async function nameFixturePrompt(identifier: string): Promise<string> {
  const name = await renderTextPrompt({
    message: 'What would you like to name this test fixture?',
    defaultValue: identifier,
    validate: (value) => {
      if (!value || value.trim() === '') {
        return "Test fixture name can't be empty"
      }
      // Check for valid filename characters
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        return 'Test fixture name can only contain letters, numbers, underscores, and hyphens'
      }
      return undefined
    },
  })

  return name.trim()
}
