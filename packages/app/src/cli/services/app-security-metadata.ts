import metadata from '../metadata.js'

/** The app security check fields on the command's analytics event. Counts only, never finding content. */
export interface AppSecurityMetadata {
  num_security_findings: number
}

export async function recordAppSecurityMetadata(fields: AppSecurityMetadata): Promise<void> {
  await metadata.addPublicMetadata(() => fields)
}
