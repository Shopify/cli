import {join as pathJoin} from '../../path.js'
import {existsSync, readFileSync} from 'node:fs'

interface FrameworkDetectionPattern {
  /**
   * @example A file path
   * ```
   * "package.json"
   * ```
   */
  path: string
  /**
   * @example A matcher
   * ```
   * "\"(dev)?(d|D)ependencies\":\\s*{[^}]*\"next\":\\s*\".+?\"[^}]*}"
   * ```
   */
  matchContent?: string
}

interface Framework {
  /**
   * Name of the framework
   * @example "nextjs"
   */
  name: string

  /**
   * Detectors used to find out the framework
   */
  detectors: {
    /**
     * Collection of detectors that must be matched for the framework
     * to be detected.
     */
    every?: FrameworkDetectionPattern[]
    /**
     * Collection of detectors where one match triggers the framework
     * to be detected.
     */
    some?: FrameworkDetectionPattern[]
  }
}

const frameworks: Framework[] = [
  {
    name: 'remix',
    detectors: {
      every: [
        {
          path: 'package.json',
          matchContent: '"(dev)?(d|D)ependencies":\\s*{[^}]*"@remix-run\\/.*":\\s*".+?"[^}]*}',
        },
        {
          path: 'package.json',
          matchContent: '"(dev)?(d|D)ependencies":\\s*{[^}]*"react":\\s*".+?"[^}]*}',
        },
      ],
    },
  },
  {
    name: 'nextjs',
    detectors: {
      every: [
        {
          path: 'package.json',
          matchContent: '"(dev)?(d|D)ependencies":\\s*{[^}]*"next":\\s*".+?"[^}]*}',
        },
        {
          path: 'package.json',
          matchContent: '"(dev)?(d|D)ependencies":\\s*{[^}]*"react":\\s*".+?"[^}]*}',
        },
      ],
    },
  },
  {
    name: 'express',
    detectors: {
      every: [
        {
          path: 'package.json',
          matchContent: '"(dev)?(d|D)ependencies":\\s*{[^}]*"express":\\s*".+?"[^}]*}',
        },
      ],
    },
  },
  {
    name: 'rails',
    detectors: {
      every: [
        {
          path: 'Gemfile',
          matchContent: 'gem "rails"',
        },
      ],
    },
  },
  {
    name: 'flask',
    detectors: {
      every: [
        {
          path: 'Pipfile',
          matchContent: 'flask',
        },
      ],
    },
  },
  {
    name: 'django',
    detectors: {
      every: [
        {
          path: 'Pipfile',
          matchContent: 'django',
        },
      ],
    },
  },
  {
    name: 'laravel',
    detectors: {
      every: [
        {
          path: 'composer.json',
          matchContent: '"require":\\s*{[^}]*"laravel/framework":\\s*".+?"[^}]*}',
        },
      ],
    },
  },
  {
    name: 'symfony',
    detectors: {
      every: [
        {
          path: 'composer.json',
          matchContent: '"require":\\s*{[^}]*"symfony\\/.*":\\s*".+?"[^}]*}',
        },
      ],
    },
  },
]

/**
 * Tries to identify the using of a framework analyzing the existence and/or content of different files inside a
 * specific directory.
 *
 * @param rootDirectory - Directory from which the files required for each framework are searched
 * @returns The name of the framework used or 'unknown' otherwise
 */
export async function resolveFramework(rootDirectory: string) {
  const fwConfigFiles: {[key: string]: string | undefined} = {}

  const matchedFramework = frameworks.find(
    (framework) =>
      (!framework.detectors?.some ||
        framework.detectors?.some?.reduce(
          (_previousDetectorsMatch: boolean, detector) =>
            matchDetector(detector, loadFwConfigFile(rootDirectory, detector.path, fwConfigFiles)),
          false,
        )) &&
      (!framework.detectors?.every ||
        framework.detectors?.every?.reduce(
          (previousDetectorsMatch: boolean, detector) =>
            previousDetectorsMatch
              ? matchDetector(detector, loadFwConfigFile(rootDirectory, detector.path, fwConfigFiles))
              : false,
          true,
        )),
  )

  return matchedFramework ? matchedFramework.name : 'unknown'
}

function matchDetector(detector: FrameworkDetectionPattern, fwConfigFiles: {[key: string]: string | undefined} = {}) {
  if (!fwConfigFiles[detector.path]) return false

  return !detector.matchContent || new RegExp(detector.matchContent).test(fwConfigFiles[detector.path]!)
}

function loadFwConfigFile(
  rootPath: string,
  fwConfigFileName: string,
  fwConfigFiles: {[key: string]: string | undefined} = {},
) {
  if (fwConfigFiles[fwConfigFileName]) {
    return fwConfigFiles
  }

  const fwConfigFilePath = pathJoin(rootPath, fwConfigFileName)
  if (!existsSync(fwConfigFilePath)) {
    return fwConfigFiles
  }

  const rawContent = readFileSync(fwConfigFilePath, {encoding: 'utf8'})

  fwConfigFiles[fwConfigFileName] = rawContent
  return fwConfigFiles
}
