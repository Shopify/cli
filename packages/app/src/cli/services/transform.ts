import * as jscodeshift from 'jscodeshift/src/Runner.js'
import {cwd, dirname, extname, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {isClean} from '@shopify/cli-kit/node/git'
import {glob, readFile} from '@shopify/cli-kit/node/fs'
import {IPluginInfo, PluginManager} from 'live-plugin-manager'
import {
  renderAutocompletePrompt,
  renderTextPrompt,
  renderWarning,
  renderSuccess,
  renderTasks,
  renderConfirmationPrompt,
} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import fs from 'fs'
import {fileURLToPath} from 'url'

interface TransformOptions {
  /** Path to the app directory to perform transform */
  path?: string

  /** Files or directory to transform */
  include?: string

  /** The package to run transforms for, \@scope/package */
  package?: string

  /** The name of transform */
  transform?: string

  /** If true, no code will be edited */
  dryRun?: boolean

  /** Show more information about the transform process */
  verbose?: boolean

  /** If true, the changed output is printed for comparison */
  print?: boolean

  /** If true, bypass Git safety checks and forcibly run transform */
  force?: boolean

  /** Options related to the specific transform */
  transformOptions?: string
}

export async function transform(options: TransformOptions) {
  const directory = options.path ? resolvePath(cwd(), options.path) : cwd()
  if (!(options.dryRun || (await isClean(directory)))) {
    if (options.force) {
      renderWarning({
        headline: 'Forcibly continuing.',
        body: 'You have opted to bypass the Git safety check. This may result in lost work.',
      })
    } else {
      throw new AbortError(
        'Before we continue, please stash or commit your git changes.\nYou may use the --force flag to override this safety check.',
      )
    }
  }

  const pluginsPath = joinPath(dirname(fileURLToPath(import.meta.url)), 'node_modules')
  const packageManager = new PluginManager({
    cwd: directory,
    pluginsPath,
  })

  const npmPackageString =
    options.package ??
    // Use the `@shopify/polaris-codemods` package as a default for now.
    // This could be removed to prompt a list of supported codemod packages
    '@shopify/polaris-codemods'
  const config = await fetchPackageConfig(npmPackageString, packageManager)
  const transforms = {...config.transforms, ...config.presets}
  const transform = options.transform ?? (await selectTransform(transforms, config))
  const transformPath = Object.entries(transforms).find(([id]) => {
    return transform === id
  })?.[1]

  if (!transformPath || !fs.existsSync(transformPath)) {
    throw new AbortError(`No transform found for ${transform}`)
  }

  const transformInfo: TransformInfo = await import(transformPath)
  const extensions = transformInfo.extensions ?? ['js', 'jsx', 'ts', 'tsx']
  const includePath = options.include ?? './'
  const globPattern = getGlobPattern(includePath, extensions)
  const filePaths = await glob(globPattern, {cwd: directory, ignore: ['**/node_modules/**'], absolute: true})

  if (filePaths.length === 0) {
    throw new AbortError(`No files found for ${options.include}`)
  }

  const transformOptionsValue = options.transformOptions ?? '{}'
  const transformOptionsJSON = transformOptionsValue.startsWith('@')
    ? await readFile(transformOptionsValue)
    : transformOptionsValue
  const transformOptions: {[key: string]: string} = JSON.parse(transformOptionsJSON)
  for (const option of Object.values(transformInfo?.options ?? {})) {
    if (option.name in transformOptions) {
      continue
    }

    const message = option.description.replace(/\.$/, '')
    /* eslint-disable no-await-in-loop */
    const input =
      option.type === 'boolean'
        ? await renderConfirmationPrompt({
            message,
            confirmationMessage: 'Yes',
            cancellationMessage: 'No',
            defaultValue: option.defaultValue ?? true,
          })
        : await renderTextPrompt({
            message: `${message} ${option.required ? '' : '(optional)'}`,
            allowEmpty: !option.required,
            defaultValue: option.defaultValue ?? '',
          })
    /* eslint-enable no-await-in-loop */

    transformOptions[option.name] = `${input}`
  }

  try {
    const res = await jscodeshift.run(transformPath, filePaths, {
      babel: true,
      silent: true,
      stdin: true,
      verbose: 2,
      ignoreConfig: [],
      extensions: 'js, jsx, ts, tsx',
      ignorePattern: '**/node_modules/**',
      parser: 'tsx',
      runInBand: false,
      dry: options.dryRun,
      print: options.print,
      ...transformOptions,
    })

    renderSuccess({
      headline: 'Transform complete.',
      body: `Not changed: ${res.nochange}
Skipped: ${res.skip}
Errors: ${res.error}
Success: ${res.ok}
Time elapsed: ${res.timeElapsed}s`,
    })
  } catch (error) {
    throw new AbortError(`Failed to execute transform ${transform}`)
  }
}

interface CodeshiftConfig {
  description?: string
  transforms?: {[key: string]: string}
  presets?: {[key: string]: string}
}

interface TransformInfo {
  extensions: string[]
  options: {
    [key: string]: StringTransformInfoOption | BooleanTransformInfoOption
  }
}

interface TransformInfoOption {
  name: string
  description: string
  required?: boolean
}

type StringTransformInfoOption = TransformInfoOption & {type: 'string'; defaultValue?: string}
type BooleanTransformInfoOption = TransformInfoOption & {type: 'boolean'; defaultValue?: boolean}

export async function fetchPackageConfig(npmPackageString: string, packageManager: PluginManager) {
  let config: CodeshiftConfig | undefined

  const tasks = [
    {
      title: `Downloading package: ${npmPackageString}`,
      task: async () => {
        config = await fetchPackage(npmPackageString, packageManager)
      },
    },
  ]

  await renderTasks(tasks)

  if (!config) {
    throw new AbortError(`Unable to locate package: ${npmPackageString}`)
  }

  return config
}

async function fetchPackage(npmPackageString: string, packageManager: PluginManager): Promise<CodeshiftConfig> {
  async function installPackageDeps(packageName: string, version?: string): Promise<IPluginInfo> {
    let info = await packageManager.alreadyInstalled(packageName, version)

    if (info) {
      return info
    }

    info = await packageManager.install(packageName, version)

    const dependencies = Object.entries(info.dependencies)
    await Promise.all(dependencies.map(([pkgName, version]) => installPackageDeps(pkgName, version)))
    return info
  }

  const {scope, packageName = npmPackageString, version} = parseNpmPackageString(npmPackageString)
  const fullPackageName = scope ? `${scope}/${packageName}` : packageName

  const info = await installPackageDeps(fullPackageName, version)

  return fetchConfig(info)
}

async function fetchConfig(packageInfo: IPluginInfo): Promise<CodeshiftConfig> {
  const configPath = packageInfo.mainFile.includes('codeshift.config.js')
    ? packageInfo.mainFile
    : joinPath(packageInfo.location, 'codeshift.config.js')
  const resolvedConfigPath = resolvePath(configPath)
  const exists = fs.existsSync(resolvedConfigPath)
  if (!exists) {
    throw new AbortError(`Found package but could not find codeshift.config.js`)
  }
  try {
    const config = await import(resolvedConfigPath)
    return 'default' in config ? config.default : config
  } catch (error) {
    throw new AbortError(
      `Found config file "${configPath}" but was unable to parse it. This can be caused when transform or preset paths are incorrect.`,
    )
  }
}

const parseNpmPackageString = (npmPackageString: string) => {
  const npmPackageStringRegex = /^(@[^/]+\/)?([^@]+)(?:@(.+))?$/

  const match = npmPackageString.match(npmPackageStringRegex)

  if (!match) {
    throw new Error('Invalid npm package string')
  }

  const scope = match[1]?.slice(0, -1) || null
  const packageName = match[2]
  const version = match[3]

  return {
    scope,
    packageName,
    version,
  }
}

const selectTransform = async (transforms: {[key: string]: string}, config: CodeshiftConfig) => {
  const transformNames = Object.keys(config.transforms ?? {})
  const presetNames = Object.keys(config.presets ?? {})
  return renderAutocompletePrompt({
    message: 'Select a transform to apply',
    choices: Object.keys(transforms).map((transformName) => {
      let group = 'Other'
      if (transformNames.includes(transformName)) {
        group = 'Transforms'
      }
      if (presetNames.includes(transformName)) {
        group = 'Presets'
      }
      return {
        value: transformName,
        label: transformName,
        group,
      }
    }),
  })
}

function isDirectoryPath(str: string) {
  return extname(str) === ''
}

function getGlobPattern(includePath: string, extensions: string[]) {
  if (isDirectoryPath(includePath)) {
    return `${includePath}/**/*.{${extensions.join(',')}}`
  }
  return includePath
}
