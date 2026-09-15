import type {Issue} from '../types.js'
import type {ScanContext} from './types.js'

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

/** File presence is an adoption signal, not proof of valid configuration, execution, or dependency coverage. */
export function scanDependencyAutomation(context: Pick<ScanContext, 'manifests' | 'dependencyAutomation'>): {
  issues: Issue[]
  unresolvedReason?: string
} {
  const manifests = context.manifests.filter(
    (manifest) =>
      Object.keys(manifest.dependencies).length > 0 || Object.keys(manifest.devDependencies ?? {}).length > 0,
  )
  if (manifests.length === 0) return {issues: []}
  const {files, unresolvedReason} = context.dependencyAutomation
  if (unresolvedReason) return {issues: [], unresolvedReason}
  if (files.length > 0) return {issues: []}

  const manifest = [...manifests].sort((left, right) => left.path.localeCompare(right.path))[0]!
  return {
    issues: [
      {
        id: 'MISSING_DEPENDENCY_SECURITY_AUTOMATION',
        severity: 'low',
        points: -5,
        title: 'Dependency management configuration file not detected',
        message:
          'No recognized Dependabot or Renovate configuration file was found. Add dependency update automation, or verify that an existing integration covers this app. This check only looks for local configuration files; it does not validate their contents or inspect hosted integrations, CI workflows, or execution results.',
        location: {file: manifest.path.replace(/\\/g, '/')},
        fix: {
          automated: false,
          description: 'Configure Dependabot or Renovate for this app, or verify existing coverage.',
        },
      },
    ],
  }
}
