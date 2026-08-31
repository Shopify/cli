import {EMBEDDED_APP_DOCTOR_INSTRUCTIONS} from './app-doctor-engine/checks/embedded.js'
import {fileExists, writeFile} from '@shopify/cli-kit/node/fs'
import {outputResult, outputSuccess} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import clipboard from 'clipboardy'

const REVIEW_FILENAME = 'app-doctor-review.json'
const SCAN_CONTEXT_PLACEHOLDER = '{{SCAN_CONTEXT}}'

const initialScanInstructions = `### 1. Run the initial scan from the app root

Identify the Shopify app root before scanning. It normally contains one or more \`shopify.app*.toml\` files.

From the app root, run:

\`\`\`bash
shopify app doctor scan
\`\`\`

If the command is unavailable, stop and tell the user that their installed Shopify CLI must provide \`shopify app doctor\`. Don't substitute a standalone package or bundled script. Use \`shopify app doctor --help\` when you need to confirm the installed CLI's current options and artifact contract.

The initial scan runs the deterministic checks and writes the review pack and initial local trace in the app root. Don't replace this step with a remembered list of checks.`

const completedScanInstructions = `### 1. Use the existing scan results

The initial scan has already completed. It generated \`app-doctor-review.json\` and the initial local \`app-doctor-trace.json\` in the app root. Don't rerun the scan unless those results are missing or the app has changed. Continue by reading the generated review pack.`

export interface AppDoctorInstructionsOptions {
  directory: string
  copy: boolean
  writePath?: string
  scanComplete?: boolean
}

interface AppDoctorInstructionsDependencies {
  reviewPackExists(path: string): Promise<boolean>
  copyToClipboard(content: string): Promise<void>
  writeToFile(path: string, content: string): Promise<void>
  output(content: string): void
  outputConfirmation(content: string): void
}

const defaultDependencies: AppDoctorInstructionsDependencies = {
  reviewPackExists: fileExists,
  copyToClipboard: (content) => clipboard.write(content),
  writeToFile: writeFile,
  output: outputResult,
  outputConfirmation: outputSuccess,
}

export function appDoctorInstructions(scanComplete: boolean): string {
  const scanContext = scanComplete ? completedScanInstructions : initialScanInstructions
  return EMBEDDED_APP_DOCTOR_INSTRUCTIONS.replace(SCAN_CONTEXT_PLACEHOLDER, scanContext).trimEnd()
}

export default async function deliverAppDoctorInstructions(
  options: AppDoctorInstructionsOptions,
  dependencies: AppDoctorInstructionsDependencies = defaultDependencies,
): Promise<void> {
  const scanComplete =
    options.scanComplete ?? (await dependencies.reviewPackExists(joinPath(options.directory, REVIEW_FILENAME)))
  const instructions = appDoctorInstructions(scanComplete)

  if (options.copy) {
    await dependencies.copyToClipboard(instructions)
    dependencies.outputConfirmation('Copied App Doctor instructions to the clipboard')
  } else if (options.writePath) {
    await dependencies.writeToFile(options.writePath, `${instructions}\n`)
    dependencies.outputConfirmation(`Wrote App Doctor instructions to ${options.writePath}`)
  } else {
    dependencies.output(instructions)
  }
}
