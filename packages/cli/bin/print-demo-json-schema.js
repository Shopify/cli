#!/usr/bin/env node

import {demoStepsSchema} from '../dist/cli/services/demo.js'
import zodToJsonSchema from "zod-to-json-schema"

const jsonSchema = zodToJsonSchema.default(demoStepsSchema, 'demo-steps')
const printable = JSON.stringify(jsonSchema)

console.log(`
You are creating a demo for a Shopify CLI command, using a strictly typed JSON file.
The file defines the steps that will be executed during the demo.

The JSON schema for this file is:
${printable}

Generate a human-readable JSON file which will be used to create the demo.

The purpose of the demo is:

The demo should perform the following steps:
`)
