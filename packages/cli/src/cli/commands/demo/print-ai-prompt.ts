import {demoStepsSchema} from '../../services/demo.js'
import zodToJsonSchema from 'zod-to-json-schema'
import Command from '@shopify/cli-kit/node/base-command'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class PrintAIPrompt extends Command {
  static description = 'Prints the prompts for a chat-enabled LLM to generate a demo'
  static hidden = true

  async run(): Promise<void> {
    const jsonSchema = zodToJsonSchema.default(demoStepsSchema, 'demo-steps')
    const printable = JSON.stringify(jsonSchema)
    renderInfo({body: 'Copy and paste the following into the system prompt.'})
    outputInfo(`You are creating a demo for a Shopify CLI command, using a strictly typed JSON file.
The file defines the steps that will be executed during the demo.

The JSON schema for this file is:
\`\`\`json
${printable}
\`\`\`
`)
    renderInfo({body: 'Then, fill out the following and paste it into the chat box.'})

    outputInfo(`Generate a human-readable JSON file which will be used to create the demo. The JSON file must be typed according to the JSON schema.

The purpose of the command is: {A short description of the command.}

The demo should perform the following steps:

{
  List the steps for the command, like:
  1. Prompt for this
  2. Autocomplete that
}

============================================================
`)
  }
}
