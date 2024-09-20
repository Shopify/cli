import {InstallGlobalCLIPromptResult, installGlobalCLIPrompt} from '@shopify/cli-kit/node/is-global'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'

export interface InitOptions {
  template?: string
  flavor?: string
}

interface InitOutput {
  template: string
  // e.g. 'remix'
  templateType: PredefinedTemplate | 'custom'
  globalCLIResult: InstallGlobalCLIPromptResult
}

interface TemplateBranch {
  branch: string
  label: string
}

interface Template {
  url: string
  label?: string
  visible: boolean
  branches?: {
    prompt: string
    options: {[key: string]: TemplateBranch}
  }
}

// Eventually this list should be taken from a remote location
// That way we don't have to update the CLI every time we add a template
export const templates = {
  remix: {
    url: 'https://github.com/Shopify/shopify-app-template-remix',
    label: 'Build a Remix app (recommended)',
    visible: true,
    branches: {
      prompt: 'For your Remix template, which language do you want?',
      options: {
        javascript: {branch: 'javascript', label: 'JavaScript'},
        typescript: {branch: 'main', label: 'TypeScript'},
      },
    },
  } as Template,
  none: {
    url: 'https://github.com/Shopify/shopify-app-template-none',
    label: 'Build an extension-only app',
    visible: true,
  } as Template,
  node: {
    url: 'https://github.com/Shopify/shopify-app-template-node',
    visible: false,
  } as Template,
  php: {
    url: 'https://github.com/Shopify/shopify-app-template-php',
    visible: false,
  } as Template,
  ruby: {
    url: 'https://github.com/Shopify/shopify-app-template-ruby',
    visible: false,
  } as Template,
} as const
type PredefinedTemplate = keyof typeof templates

const allTemplates = Object.keys(templates) as Readonly<PredefinedTemplate[]>
export const visibleTemplates = allTemplates.filter((key) => templates[key].visible) as Readonly<PredefinedTemplate[]>

const templateOptionsInOrder = ['remix', 'none'] as const

const init = async (options: InitOptions): Promise<InitOutput> => {
  let template = options.template
  const flavor = options.flavor

  const defaults = {
    template: templates.remix.url,
  } as const

  if (!template) {
    template = await renderSelectPrompt({
      choices: templateOptionsInOrder.map((key) => {
        return {
          label: templates[key].label || key,
          value: key,
        }
      }),
      message: 'Get started building your app:',
      defaultValue: allTemplates.find((key) => templates[key].url === defaults.template),
    })
  }

  const answers: InitOutput = {
    ...options,
    template,
    templateType: isPredefinedTemplate(template) ? template : 'custom',
    globalCLIResult: {install: false, alreadyInstalled: false},
  }

  let selectedUrl: string | undefined
  let branch: string | undefined
  if (answers.templateType !== 'custom') {
    const selectedTemplate = templates[answers.templateType]
    selectedUrl = selectedTemplate.url

    if (selectedTemplate.branches) {
      if (flavor) {
        branch = selectedTemplate.branches.options[flavor]?.branch
      } else {
        branch = await renderSelectPrompt({
          message: selectedTemplate.branches.prompt || 'Choose a flavor:',
          choices: Object.entries(selectedTemplate.branches.options).map(([_key, branch]) => ({
            value: branch.branch,
            label: branch.label,
          })),
        })
      }
    }
  }

  if (branch) {
    selectedUrl += `#${branch}`
  }

  answers.template = selectedUrl || answers.template || defaults.template

  answers.globalCLIResult = await installGlobalCLIPrompt()

  return answers
}

export default init

export function isPredefinedTemplate(template: string): template is PredefinedTemplate {
  return allTemplates.includes(template as PredefinedTemplate)
}
