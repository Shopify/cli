/** A fresh valid saved-entry input for the shared schema and its command wrappers. */
export function savedSuppressionFixture(path: string) {
  return {
    index: 0,
    change: 'added',
    source: 'agent',
    check: 'CREDENTIAL_LOG_LEAKAGE',
    kind: 'false-positive',
    path,
    code: 'console.log(session.accessToken)',
    reason: 'The logger redacts tokens.',
  }
}
