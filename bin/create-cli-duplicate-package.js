import { copyFile, cp, readFile, writeFile } from "fs/promises"

await cp('./packages/cli', './packages/cli-copy', { recursive: true })

const packageJsonFile = await readFile('./packages/cli-copy/package.json')
const packageJsonJson = JSON.parse(packageJsonFile.toString())
packageJsonJson.name = "shopify"

const projectJsonFile = await readFile('./packages/cli-copy/project.json')
const projectJsonJson = JSON.parse(projectJsonFile.toString())
projectJsonJson.name = "shopify"
projectJsonJson.sourceRoot = "packages/cli-copy/src"

await writeFile('./packages/cli-copy/package.json', JSON.stringify(packageJsonJson, null, 2))
await writeFile('./packages/cli-copy/project.json', JSON.stringify(projectJsonJson, null, 2))

