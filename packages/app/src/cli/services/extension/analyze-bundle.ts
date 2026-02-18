import {bundleExtension} from '../extensions/bundle.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {AppInterface} from '../../models/app/app.js'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {writeFile, tempDirectory, readFileSync} from '@shopify/cli-kit/node/fs'
import {openURL} from '@shopify/cli-kit/node/system'
import {renderInfo, renderAutocompletePrompt, renderConcurrent} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'
import {gzipSync} from 'zlib'
import type {Metafile} from 'esbuild'

interface AnalyzeBundleOptions {
  app: AppInterface
  extensionHandle?: string
  json: boolean
  html: boolean
}

interface PackageInfo {
  name: string
  bytes: number
  percentage: number
}

interface ExtensionAnalysis {
  handle: string
  type: string
  bundleSize: number
  bundleSizeFormatted: string
  gzipSize: number
  gzipSizeFormatted: string
  dependencies: PackageInfo[]
  inputs: {path: string; bytes: number}[]
}

export async function analyzeBundle(options: AnalyzeBundleOptions): Promise<void> {
  const extensions = await selectExtensions(options.app, options.extensionHandle)

  const metafilesByExtension = new Map<string, Metafile>()

  await renderConcurrent({
    processes: extensions.map((extension) => ({
      prefix: extension.localIdentifier,
      action: async (stdout: Writable, stderr: Writable) => {
        stdout.write(`Building ${extension.localIdentifier} for analysis...`)
        const metafile = await collectMetafiles(extension, options.app, stdout, stderr)
        metafilesByExtension.set(extension.handle, metafile)
        stdout.write(`Done.`)
      },
    })),
    showTimestamps: false,
  })

  const analyses: ExtensionAnalysis[] = []
  for (const extension of extensions) {
    const metafile = metafilesByExtension.get(extension.handle)!
    // eslint-disable-next-line no-await-in-loop
    const analysis = await parseMetafile(metafile, extension)
    analyses.push(analysis)
  }

  if (options.html) {
    for (const extension of extensions) {
      const metafile = metafilesByExtension.get(extension.handle)!
      // eslint-disable-next-line no-await-in-loop
      await formatAsHtml(metafile, extension)
    }
  } else if (options.json) {
    formatAsJson(analyses)
  } else {
    formatAsText(analyses)
  }
}

export async function selectExtensions(
  app: AppInterface,
  extensionHandle?: string,
): Promise<ExtensionInstance[]> {
  const esbuildExtensions = app.allExtensions.filter((ext) => ext.isESBuildExtension)

  if (esbuildExtensions.length === 0) {
    throw new AbortError('No extensions found in this app.', 'Make sure your app has UI extensions.')
  }

  if (extensionHandle) {
    const matched = esbuildExtensions.find((ext) => ext.handle === extensionHandle)
    if (!matched) {
      throw new AbortError(
        `Extension "${extensionHandle}" not found.`,
        `Available extensions: ${esbuildExtensions.map((ext) => ext.handle).join(', ')}`,
      )
    }
    return [matched]
  }

  if (esbuildExtensions.length === 1) {
    return esbuildExtensions
  }

  if (isTerminalInteractive()) {
    const selected = await renderAutocompletePrompt({
      message: 'Which extension do you want to analyze?',
      choices: [
        {label: 'All extensions', value: '__all__'},
        ...esbuildExtensions.map((ext) => ({label: ext.handle, value: ext.handle})),
      ],
    })
    if (selected === '__all__') {
      return esbuildExtensions
    }
    return esbuildExtensions.filter((ext) => ext.handle === selected)
  }

  return esbuildExtensions
}

async function collectMetafiles(
  extension: ExtensionInstance,
  app: AppInterface,
  stdout: Writable,
  stderr: Writable,
): Promise<Metafile> {
  const env = app.dotenv?.variables ?? {}
  const {main, assets} = extension.getBundleExtensionStdinContent()

  const mainMetafile = await bundleExtension({
    minify: true,
    outputPath: extension.outputPath,
    stdin: {
      contents: main,
      resolveDir: extension.directory,
      loader: 'tsx',
    },
    environment: 'production',
    env,
    stderr,
    stdout,
    metafile: true,
  })

  const combined: Metafile = mainMetafile ?? {inputs: {}, outputs: {}}

  if (assets) {
    for (const asset of assets) {
      // eslint-disable-next-line no-await-in-loop
      const assetMetafile = await bundleExtension({
        minify: true,
        outputPath: joinPath(dirname(extension.outputPath), asset.outputFileName),
        stdin: {
          contents: asset.content,
          resolveDir: extension.directory,
          loader: 'tsx',
        },
        environment: 'production',
        env,
        stderr,
        stdout,
        metafile: true,
      })

      if (assetMetafile) {
        Object.assign(combined.inputs, assetMetafile.inputs)
        Object.assign(combined.outputs, assetMetafile.outputs)
      }
    }
  }

  return combined
}

async function parseMetafile(metafile: Metafile, extension: ExtensionInstance): Promise<ExtensionAnalysis> {
  const inputs = Object.entries(metafile.inputs).map(([path, info]) => ({
    path,
    bytes: info.bytes,
  }))

  // Bundle size from outputs (minified, uncompressed)
  const bundleSize = Object.values(metafile.outputs).reduce((sum, output) => sum + output.bytes, 0)

  // Gzip size from reading the actual output file
  let gzipSize = 0
  try {
    const outputContent = readFileSync(extension.outputPath)
    gzipSize = gzipSync(outputContent).length
  // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // If we can't read the file, fall back to 0
  }

  // Use output bytesInOutput for per-package contribution to final bundle
  const outputInputs = Object.values(metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs).map(([path, {bytesInOutput}]) => ({path, bytes: bytesInOutput})),
  )
  const packages = groupByPackage(outputInputs.length > 0 ? outputInputs : inputs)

  const dependencies: PackageInfo[] = packages
    .map((pkg) => ({
      name: pkg.name,
      bytes: pkg.bytes,
      percentage: bundleSize > 0 ? Math.round((pkg.bytes / bundleSize) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes)

  return {
    handle: extension.handle,
    type: extension.specification.externalName,
    bundleSize,
    bundleSizeFormatted: formatBytes(bundleSize),
    gzipSize,
    gzipSizeFormatted: formatBytes(gzipSize),
    dependencies,
    inputs,
  }
}

export function groupByPackage(inputs: {path: string; bytes: number}[]): {name: string; bytes: number}[] {
  const groups: Record<string, number> = {}

  for (const input of inputs) {
    const packageName = extractPackageName(input.path)
    groups[packageName] = (groups[packageName] ?? 0) + input.bytes
  }

  return Object.entries(groups)
    .map(([name, bytes]) => ({name, bytes}))
    .sort((a, b) => b.bytes - a.bytes)
}

function extractPackageName(filePath: string): string {
  const nodeModulesIndex = filePath.lastIndexOf('node_modules/')
  if (nodeModulesIndex === -1) {
    return '(project source)'
  }

  const afterNodeModules = filePath.slice(nodeModulesIndex + 'node_modules/'.length)

  if (afterNodeModules.startsWith('@')) {
    const parts = afterNodeModules.split('/')
    return `${parts[0]}/${parts[1]}`
  }

  return afterNodeModules.split('/')[0]!
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function formatAsText(analyses: ExtensionAnalysis[]): void {
  for (const analysis of analyses) {
    const summary = [
      `Bundle size: ${analysis.bundleSizeFormatted} (minified) / ${analysis.gzipSizeFormatted} (gzip)`,
      `Input files: ${analysis.inputs.length}`,
    ].join('\n')

    const tabularData = analysis.dependencies.map((dep) => [
      dep.name,
      formatBytes(dep.bytes),
      `${dep.percentage.toFixed(1)}%`,
    ])

    renderInfo({
      headline: `${analysis.handle} (${analysis.type})`,
      body: summary,
      customSections: [
        {
          title: 'Dependencies by size',
          body: {tabularData},
        },
      ],
    })
  }
}

function formatAsJson(analyses: ExtensionAnalysis[]): void {
  const output = {
    extensions: analyses.map((analysis) => ({
      handle: analysis.handle,
      type: analysis.type,
      bundleSize: analysis.bundleSize,
      bundleSizeFormatted: analysis.bundleSizeFormatted,
      gzipSize: analysis.gzipSize,
      gzipSizeFormatted: analysis.gzipSizeFormatted,
      dependencies: analysis.dependencies,
      inputs: analysis.inputs,
    })),
  }
  outputInfo(JSON.stringify(output, null, 2))
}

async function formatAsHtml(metafile: Metafile, extension: ExtensionInstance): Promise<string> {
  const {visualizer} = await import('esbuild-visualizer')
  const html = await visualizer(metafile, {title: `Bundle: ${extension.handle}`})
  const filePath = joinPath(tempDirectory(), `bundle-analysis-${extension.handle}.html`)
  await writeFile(filePath, html)
  outputInfo(`Bundle report written to ${filePath}`)
  await openURL(`file://${filePath}`)
  return filePath
}
