/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {demoStepsSchema, DemoStep} from '../../services/demo.js'
import zodToJsonSchema from 'zod-to-json-schema'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {AbortError} from '@shopify/cli-kit/node/error'
import {mkdir, fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {outputContent, outputSuccess, outputToken} from '@shopify/cli-kit/node/output'
import {resolvePath, joinPath, cwd} from '@shopify/cli-kit/node/path'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {createRequire} from 'module'

const schemaFilename = 'demo-schema.json'

export default class GenerateFile extends Command {
  static description = 'Create a command design file'
  static summary = 'Creates a JSON file alongside a JSON schema that will validate it'
  static hidden = true

  static flags = {
    path: Flags.string({
      hidden: false,
      description: 'The directory for generating the demo file.',
      env: 'SHOPIFY_FLAG_PATH',
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
    }),
    file: Flags.string({
      hidden: false,
      description: 'The name of the demo file.',
      env: 'SHOPIFY_FLAG_FILENAME',
      required: true,
      validate: (input: string) => {
        if (input === schemaFilename) {
          return `The demo file can't be named ${schemaFilename}, as this is used for the schema file.`
        }
        return true
      },
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(GenerateFile)
    await mkdir(flags.path)
    const demoFilePath = joinPath(flags.path, flags.file)
    if (await fileExists(demoFilePath)) {
      throw new AbortError(`The file ${demoFilePath} already exists.`)
    }
    const demoSchemaPath = joinPath(flags.path, schemaFilename)
    const jsonSchema = zodToJsonSchema.default(demoStepsSchema, 'demo-steps')
    await Promise.all([
      writeFile(demoSchemaPath, JSON.stringify(jsonSchema, null, 2)),
      writeFile(
        demoFilePath,
        JSON.stringify(
          {
            $schema: `./${schemaFilename}`,
            steps: await selectSteps(),
          },
          null,
          2,
        ),
      ),
    ])
    outputSuccess(outputContent`Created ${outputToken.path(demoFilePath)} and ${outputToken.path(demoSchemaPath)}`)
  }
}

async function selectSteps(): Promise<DemoStep[]> {
  const require = createRequire(import.meta.url)
  const catalogFile = require.resolve('@shopify/cli/assets/demo-catalog.json')
  const {steps} = JSON.parse(await readFile(catalogFile)) as {steps: DemoStep[]}
  const selectedSteps: DemoStep[] = []
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const stepSelection = await renderAutocompletePrompt({
      message: 'Add a step to the demo file',
      choices: [
        {
          label: "I'm done",
          value: 'done',
        },
        ...steps.map(({title, type}) => {
          return {
            label: title!,
            value: title!,
            group: type,
          }
        }),
      ],
    })
    if (stepSelection === 'done') break
    selectedSteps.push(steps.find(({title}) => title === stepSelection)!)
  }
  return selectedSteps
}
