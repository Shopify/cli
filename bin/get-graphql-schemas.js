#! /usr/bin/env node
import {Octokit} from '@octokit/rest'
import {createTokenAuth} from '@octokit/auth-token'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import {spawn} from 'child_process'

const BRANCH = 'main'
const OWNER = 'Shopify'

const schemas = [
  {
    repo: 'partners',
    pathToFile: 'db/graphql/cli_schema.graphql',
    localPath: './packages/app/src/cli/api/graphql/partners/cli_schema.graphql',
  },
  {
    repo: 'business-platform',
    pathToFile: 'db/graphql/destinations_schema.graphql',
    localPath: './packages/app/src/cli/api/graphql/business-platform/destinations_schema.graphql',
  },
]

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: ['inherit', 'pipe', 'pipe']})

    let output = ''
    let errorOutput = ''

    child.stdout.on('data', (data) => {
      console.log(data.toString())
      output += data.toString()
    })

    child.stderr.on('data', (data) => {
      console.log(data.toString())
      errorOutput += data.toString()
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}\n${errorOutput}`))
      } else {
        resolve(output)
      }
    })
  })
}

function extractPassword(output) {
  const passwordRegex = /Password: (\w+)/
  const match = output.match(passwordRegex)
  if (match && match[1]) {
    return match[1]
  }
  throw new Error('Password not found in output')
}

async function fetchFileForSchema(schema, octokit) {
  try {
    // Fetch the file content from the repository
    const {data} = await octokit.repos.getContent({
      owner: OWNER,
      repo: schema.repo,
      path: schema.pathToFile,
      ref: BRANCH,
    })

    // Decode the base64 content
    const content = Buffer.from(data.content, 'base64').toString('utf-8')

    // Define the local path where the file will be saved
    const localFilePath = schema.localPath

    const dir = path.dirname(localFilePath)
    fs.mkdirSync(dir, {recursive: true})

    // Write the content to a local file
    fs.writeFileSync(localFilePath, content)

    console.log(`File downloaded successfully to ${localFilePath}`)
    return true
  } catch (error) {
    console.error(`Error fetching file: ${error.message}`)
    return false
  }
}

async function getGithubPasswordFromDev() {
  try {
    // Uses token from `dev`
    const output = await runCommand('/opt/dev/bin/dev', ['github', 'print-auth'])
    const password = extractPassword(output)
    return password
  } catch (error) {
    console.warn(`Soft-error fetching password from dev: ${error.message}`)
    process.exit(0)
  }
}

async function fetchFiles() {
  let password = undefined
  let tokenFromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (!tokenFromEnv) {
    password = await getGithubPasswordFromDev()
  }
  const authToken = password || tokenFromEnv

  console.log(`Using token: ${authToken}`)
  const octokit = new Octokit({
    auth: authToken,
  })

  let allSuccess = true
  for (const schema of schemas) {
    allSuccess = await fetchFileForSchema(schema, octokit) && allSuccess
  }

  if (!allSuccess) {
    console.error('Failed to fetch all files')
    process.exit(1)
  }
}

fetchFiles()
