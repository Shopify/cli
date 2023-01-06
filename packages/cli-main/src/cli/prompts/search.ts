import {ui} from '@shopify/cli-kit'

interface SearchPromptOptions {
  query?: string
}

// // Utitlity types (typescript)
// type X = Required<SearchPromptOptions>

export async function searchPrompt({query}: SearchPromptOptions): Promise<Required<SearchPromptOptions>> {
  if (query) {
    return {query}
  } else {
    return ui.prompt([
      {
        type: 'input',
        name: 'query',
        message: 'What are you searching for?',
        default: '',
      },
    ])
  }
}
