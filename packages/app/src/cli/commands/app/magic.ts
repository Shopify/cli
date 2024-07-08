import {accessScopesContext} from './access-scopes.js'
import {appFlags} from '../../flags.js'
import {AppInterface} from '../../models/app/app.js'
import {loadApp} from '../../models/app/loader.js'
import Command from '../../utilities/app-command.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderTextPrompt, renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import OpenAI from 'openai'

const OPENAI_COMPLETIONS_MODEL = 'gpt-4o'

const conversationHistory: OpenAI.ChatCompletionMessageParam[] = [{role: 'system', content: accessScopesContext()}]

export default class AppMagic extends Command {
  static summary = 'Do some magic.'

  static descriptionWithMarkdown = `All the magic.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    json: Flags.boolean({
      hidden: false,
      description: 'format output as JSON',
      env: 'SHOPIFY_FLAG_JSON',
    }),
    'web-env': Flags.boolean({
      hidden: false,
      description: 'Outputs environment variables necessary for running and deploying web/.',
      env: 'SHOPIFY_FLAG_OUTPUT_WEB_ENV',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AppMagic)
    const specifications = await loadLocalExtensionsSpecifications()
    const app: AppInterface = await loadApp({
      specifications,
      directory: flags.path,
      userProvidedConfigName: flags.config,
      mode: 'report',
    })

    const openai = new OpenAI({
      baseURL: 'https://openai-proxy.shopify.ai/v1',
      apiKey:
        'shopify-eyJtb2RlIjoicGVyc29uYWwiLCJlbWFpbCI6ImphbWllLmd1ZXJyZXJvQHNob3BpZnkuY29tIiwiZXhwaXJ5IjoxNzE5NzY2MDAwfQ==-3bcSSoPdOb8e2VsdYfdFEEZWDhxU37oiv3SuXYu9vgk=',
    })

    const promptAndContinue = async () => {
      const question = await renderTextPrompt({message: 'Describe the app you are trying to build'})

      conversationHistory.push({role: 'user', content: question})

      const result = await openai.chat.completions.create({
        model: OPENAI_COMPLETIONS_MODEL,
        messages: conversationHistory,
      })

      const aiResponse = result?.choices[0]?.message?.content || ''

      conversationHistory.push({role: 'system', content: aiResponse})

      const action = await renderSelectPrompt({
        message: aiResponse,
        choices: [
          {
            label: 'Write to shopify.app.toml',
            value: 'write',
          },
          {
            label: 'Write to another config file',
            value: 'writeCustomConfig',
          },
          {
            label: 'Try again',
            value: 'tryAgain',
          },
        ],
        defaultValue: 'tryAgain',
      })

      switch (action) {
        case 'write':
          break
        case 'writeCustomConfig':
          break
        case 'tryAgain':
          await promptAndContinue()
          break

        default:
          await promptAndContinue()
          break
      }
    }

    await promptAndContinue()

    if (app.errors) process.exit(2)
  }
}
