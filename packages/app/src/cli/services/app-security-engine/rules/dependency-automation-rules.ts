import type {Issue} from '../types.js'
import type {ManifestFile, ScanContext} from './types.js'

export const DEPENDENCY_AUTOMATION_CONFIG_PATHS = [
  '.github/dependabot.yml',
  '.github/dependabot.yaml',
  'renovate.json',
  'renovate.jsonc',
  'renovate.json5',
  '.github/renovate.json',
  '.github/renovate.jsonc',
  '.github/renovate.json5',
  '.gitlab/renovate.json',
  '.gitlab/renovate.jsonc',
  '.gitlab/renovate.json5',
  '.renovaterc',
  '.renovaterc.json',
  '.renovaterc.jsonc',
  '.renovaterc.json5',
]

function hasDeclaredDependencies(manifest: ManifestFile): boolean {
  return Object.keys(manifest.dependencies).length > 0 || Object.keys(manifest.devDependencies ?? {}).length > 0
}

function repositoryManifestPath(path: string): string {
  return path.replace(/\\/g, '/')
}

/** Dependabot and Renovate configuration is repository-level, so prefer the root manifest. */
function dependencyAutomationFindingFile(manifests: ManifestFile[]): string {
  const paths = manifests.map((manifest) => repositoryManifestPath(manifest.path))
  const root = paths.find((path) => path === 'package.json')
  if (root) return root

  return [...paths].sort((left, right) => {
    const depthDelta = left.split('/').length - right.split('/').length
    return depthDelta === 0 ? left.localeCompare(right) : depthDelta
  })[0]!
}

/** File presence is an adoption signal, not proof of valid configuration, execution, or dependency coverage. */
export function scanDependencyAutomation(context: Pick<ScanContext, 'manifests' | 'dependencyAutomation'>): {
  issues: Issue[]
  unresolvedReason?: string
} {
  const manifests = context.manifests.filter(hasDeclaredDependencies)
  if (manifests.length === 0) return {issues: []}
  const {files, unresolvedReason} = context.dependencyAutomation
  if (unresolvedReason) return {issues: [], unresolvedReason}
  if (files.length > 0) return {issues: []}

  return {
    issues: [
      {
        id: 'MISSING_DEPENDENCY_SECURITY_AUTOMATION',
        severity: 'low',
        points: -5,
        title: 'Repository-level dependency management configuration not detected',
        message:
          'No recognized Dependabot or Renovate configuration file was found at the repository root. Add dependency update automation there, or verify that an existing integration covers this app. This check only looks for local configuration files; it does not validate their contents or inspect hosted integrations, CI workflows, or execution results.',
        location: {file: dependencyAutomationFindingFile(manifests)},
        fix: {
          automated: false,
          description:
            'Add a Dependabot or Renovate configuration file at the repository root, or verify existing coverage.',
        },
      },
    ],
  }
}
