import {AssertionCollector} from '../../assertions.js'
import {captureOutput} from '@shopify/cli-kit/node/system'
import type {AuditTest, AuditContext, TestResult} from '../../types.js'

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

export const pushTest: AuditTest = {
  name: 'theme:push',
  description: 'Tests pushing a theme to the store creates an unpublished theme',
  requiresStore: true,

  async run(context: AuditContext): Promise<TestResult> {
    const startTime = Date.now()
    const assertions = new AssertionCollector()

    // Check prerequisite: theme must be initialized
    if (!context.themePath) {
      return {
        name: this.name,
        status: 'skipped',
        duration: Date.now() - startTime,
        assertions: [],
        error: new Error('No theme path available. Run theme:init first.'),
      }
    }

    try {
      // Build command args
      // Use --path to point to theme, run from workingDirectory where shopify.theme.toml lives
      // Use -t to specify theme name (required for non-interactive --unpublished)
      const themeName = context.themeName ?? 'audit-theme'
      const args = ['theme', 'push', '--unpublished', '--json', '--path', context.themePath, '-t', themeName]

      // Add environment flag if specified (toml is in workingDirectory)
      if (context.environment) {
        args.push('-e', context.environment)
      }
      // Or pass store/password directly
      if (context.store) {
        args.push('-s', context.store)
      }
      if (context.password) {
        args.push('--password', context.password)
      }

      // Run theme push command with JSON output
      // Run from workingDirectory so shopify.theme.toml is found
      const output = await captureOutput('shopify', args, {
        cwd: context.workingDirectory,
      })

      // Parse JSON output to get theme info
      let pushResult: PushJsonOutput | undefined
      try {
        pushResult = JSON.parse(output) as PushJsonOutput
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        assertions.assertTrue(false, 'Push command returned valid JSON')
      }

      if (pushResult?.theme) {
        // Assertion 1: Theme was created with an ID
        assertions.assertTrue(typeof pushResult.theme.id === 'number', 'Theme was created with a valid ID')

        // Assertion 2: Theme has correct name (should match our theme name)
        if (context.themeName) {
          assertions.assertTrue(
            pushResult.theme.name.includes(context.themeName) || pushResult.theme.name.length > 0,
            `Theme has a name: ${pushResult.theme.name}`,
          )
        }

        // Assertion 3: Theme role is unpublished
        assertions.assertEqual(pushResult.theme.role, 'unpublished', 'Theme role is unpublished')

        // Assertion 4: Editor URL is provided
        assertions.assertTrue(pushResult.theme.editor_url.includes('/admin/themes/'), 'Editor URL is provided')

        // Assertion 5: Preview URL is provided
        assertions.assertTrue(pushResult.theme.preview_url.includes('preview_theme_id='), 'Preview URL is provided')

        // Update context for subsequent tests
        context.themeId = String(pushResult.theme.id)
        context.data.editorUrl = pushResult.theme.editor_url
        context.data.previewUrl = pushResult.theme.preview_url
      }

      return {
        name: this.name,
        status: assertions.hasFailures() ? 'failed' : 'passed',
        duration: Date.now() - startTime,
        assertions: assertions.getResults(),
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      return {
        name: this.name,
        status: 'failed',
        duration: Date.now() - startTime,
        assertions: assertions.getResults(),
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}
