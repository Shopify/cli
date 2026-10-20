import {projectThemeInitResult, themeInitJsonOutputSchema} from './types.js'
import {jsonSchemaValidate, normaliseJsonSchema} from '@shopify/cli-kit/node/json-schema'
import {expect, test} from 'vitest'

test('publishes a resolvable JSON schema for results with instruction files', async () => {
  const schema = await normaliseJsonSchema(JSON.stringify(themeInitJsonOutputSchema.jsonSchema))
  const result = projectThemeInitResult({
    path: '.',
    repoUrl: 'https://example.com/theme.git',
    latest: true,
    aiInstructions: 'claude',
    instructionFiles: ['AGENTS.md'],
  })

  expect(jsonSchemaValidate(result, schema, 'fail').state).toBe('ok')
  expect(jsonSchemaValidate({...result, instructionFilePaths: [42]}, schema, 'fail').state).toBe('error')
})
