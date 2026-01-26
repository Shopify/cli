import {AuditSuite} from '../../framework.js'

interface PushJsonOutput {
  theme: {
    id: number
    name: string
    role: string
    shop: string
    editor_url: string
    preview_url: string
  }
}

/**
 * Tests for `shopify theme push` command
 */
export default class ThemePushTests extends AuditSuite {
  static description = 'Tests pushing a theme to the store creates an unpublished theme'
  static requiresStore = true

  async 'test push creates unpublished theme'() {
    // Check prerequisite: theme must be initialized
    if (!this.context.themePath) {
      this.assert(false, 'Theme path available (run theme:init first)')
      return
    }

    // Build command
    const themeName = this.context.themeName ?? 'audit-theme'
    let cmd = `shopify theme push --unpublished --json --path ${this.context.themePath} -t ${themeName}`

    if (this.context.environment) {
      cmd += ` -e ${this.context.environment}`
    }
    if (this.context.store) {
      cmd += ` -s ${this.context.store}`
    }
    if (this.context.password) {
      cmd += ` --password ${this.context.password}`
    }

    const result = await this.run(cmd)
    this.assertSuccess(result)

    // Parse and validate JSON output
    const json = this.assertJson<PushJsonOutput>(result, (data) => typeof data.theme?.id === 'number')

    if (json?.theme) {
      this.assert(typeof json.theme.id === 'number', 'Theme was created with a valid ID')
      this.assertEqual(json.theme.role, 'unpublished', 'Theme role is unpublished')
      this.assert(json.theme.editor_url.includes('/admin/themes/'), 'Editor URL is provided')
      this.assert(json.theme.preview_url.includes('preview_theme_id='), 'Preview URL is provided')

      // Update context for subsequent tests
      this.context.themeId = String(json.theme.id)
      this.context.data.editorUrl = json.theme.editor_url
      this.context.data.previewUrl = json.theme.preview_url
    }
  }
}

// Also export the old interface for backwards compatibility during transition
export const pushTest = {
  name: 'theme:push',
  description: ThemePushTests.description,
  requiresStore: true,
  async run(context: import('../../types.js').AuditContext) {
    const suite = new ThemePushTests()
    const results = await suite.runSuite(context)
    const allAssertions = results.flatMap((r) => r.assertions)
    const hasFailures = results.some((r) => r.status === 'failed')
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
    return {
      name: 'theme:push',
      status: hasFailures ? 'failed' : ('passed' as const),
      duration: totalDuration,
      assertions: allAssertions,
      error: results.find((r) => r.error)?.error,
    }
  },
}
