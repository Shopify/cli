export interface FrameworkDetectionItem {
  /**
   * A file path
   * @example "package.json"
   */
  path: string
  /**
   * A matcher
   * @example "\"(dev)?(d|D)ependencies\":\\s*{[^}]*\"next\":\\s*\".+?\"[^}]*}"
   */
  matchContent?: string
}

export interface Framework {
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
    every?: FrameworkDetectionItem[]
    /**
     * Collection of detectors where one match triggers the framework
     * to be detected.
     */
    some?: FrameworkDetectionItem[]
  }
}

export const frameworks: Framework[] = [
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
