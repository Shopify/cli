#!/usr/bin/env node

import { api, session, file } from "@shopify/cli-kit";
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const apiKey = "2290c8492efaf47c196be52ab88b67f7"

const token = await session.ensureAuthenticatedPartners()
const query = api.graphql.ExtensionSpecificationsQuery
const result = await api.partners.request(query, token, {api_key: apiKey})
const cliExtensions = result.extensionSpecifications.filter(ext => ext.options.managementExperience === "cli")

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = `${__dirname}/../packages/app/src/cli/models/app/extensions-specifications.generated.ts`
const comment = "// automatically generated file"
await fs.writeFileSync(filePath, `${comment}\nexport const extensionSpecifications = ${JSON.stringify(cliExtensions, null, 2)}` , 'utf-8');

console.log("DONE")
