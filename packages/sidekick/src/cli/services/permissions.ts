import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export interface ToolAnnotations {
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

export interface ToolCallRequest {
  name: string
  serverName: string
  arguments: {[key: string]: unknown}
  annotations?: ToolAnnotations
}

export interface PermissionOptions {
  yolo: boolean
  interactive: boolean
}

export type PermissionResult = 'approved' | 'denied'

export async function checkToolPermission(
  tool: ToolCallRequest,
  options: PermissionOptions,
): Promise<PermissionResult> {
  // Read-only tools are always approved
  if (tool.annotations?.readOnlyHint === true) {
    return 'approved'
  }

  // Yolo mode auto-approves everything
  if (options.yolo) {
    return 'approved'
  }

  // Interactive mode: prompt user
  if (options.interactive) {
    const message = `Allow tool "${tool.name}" from server "${tool.serverName}"?`
    const args = JSON.stringify(tool.arguments, null, 2)
    const confirmed = await renderConfirmationPrompt({
      message: `${message}\nArguments: ${args}`,
    })
    return confirmed ? 'approved' : 'denied'
  }

  // Non-interactive without yolo: deny
  return 'denied'
}

export async function checkShellPermission(
  command: string,
  reason: string | undefined,
  options: PermissionOptions,
): Promise<PermissionResult> {
  if (options.yolo) {
    return 'approved'
  }

  if (options.interactive) {
    const prompt = reason
      ? ['Run ', {command}, '  ', {subdued: `Purpose: ${reason}`}]
      : ['Run ', {command}]
    const confirmed = await renderConfirmationPrompt({
      message: prompt,
    })
    return confirmed ? 'approved' : 'denied'
  }

  return 'denied'
}
