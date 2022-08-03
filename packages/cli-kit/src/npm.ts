import {join} from './path.js'
import * as file from './file.js'
import * as os from './os.js'
import {debug, token, content} from './output.js'

interface JSON {
  [key: string]: JSONValue
}

type JSONValue = string | number | boolean | JSON | JSONValue[]

export interface PackageJSON extends JSON {
  name: string
  author: string
  dependencies: {[key: string]: string}
  devDependencies: {[key: string]: string}
  resolutions: {[key: string]: string}
  overrides: {[key: string]: string}
  scripts: {[key: string]: string}
}

export async function readPackageJSON(directory: string): Promise<PackageJSON> {
  debug(content`Reading and decoding the content from package.json at ${token.path(directory)}...`)
  const packagePath = join(directory, 'package.json')
  const packageJSON = JSON.parse(await file.read(packagePath))

  return packageJSON
}

export async function writePackageJSON(directory: string, packageJSON: JSON): Promise<void> {
  debug(content`JSON-encoding and writing content to package.json at ${token.path(directory)}...`)
  const packagePath = join(directory, 'package.json')
  await file.write(packagePath, JSON.stringify(packageJSON, null, 2))
}

export async function updateAppData(packageJSON: JSON, name: string): Promise<void> {
  packageJSON.name = name
  packageJSON.author = (await os.username()) ?? ''
}
