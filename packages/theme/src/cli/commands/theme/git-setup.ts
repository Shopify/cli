import ThemeCommand from '../../utilities/theme-command.js'
import {
  setupMultiEnvironmentGit,
  resetGitConfiguration,
  isGitConfiguredForMultiEnv,
} from '../../utilities/git-config.js'
import {Flags} from '@oclif/core'
import {outputInfo, outputSuccess, outputWarn} from '@shopify/cli-kit/node/output'
import {cwd} from '@shopify/cli-kit/node/path'
import {insideGitDirectory} from '@shopify/cli-kit/node/git'
import {AbortError} from '@shopify/cli-kit/node/error'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class GitSetup extends ThemeCommand {
  static summary = 'Configure Git for conflict-free multi-environment theme development'
  static description =
    'Setup Git merge strategies to eliminate conflicts when working with themes across multiple environments (dev, staging, production).'

  static flags = {
    ...globalFlags,
    'multi-environment': Flags.boolean({
      description: 'Setup Git merge strategies for multi-environment themes',
      default: false,
      env: 'SHOPIFY_FLAG_MULTI_ENVIRONMENT',
    }),
    reset: Flags.boolean({
      description: 'Reset Git configuration to remove Shopify theme customizations',
      default: false,
      env: 'SHOPIFY_FLAG_RESET',
    }),
    status: Flags.boolean({
      description: 'Show current Git configuration status',
      default: false,
      env: 'SHOPIFY_FLAG_STATUS',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(GitSetup)
    const rootPath = cwd()

    // Ensure we're in a Git repository
    if (!(await insideGitDirectory(rootPath))) {
      throw new AbortError('This command must be run inside a Git repository')
    }

    if (flags.status) {
      await this.showStatus(rootPath)
      return
    }

    if (flags.reset) {
      await resetGitConfiguration(rootPath)
      return
    }

    if (flags['multi-environment']) {
      await setupMultiEnvironmentGit(rootPath)
      await this.showNextSteps()
      return
    }

    outputInfo('Use --multi-environment to setup conflict-free theme development')
    outputInfo('Use --status to check current configuration')
    outputInfo('Use --reset to remove Shopify theme Git customizations')
  }

  private async showStatus(rootPath: string): Promise<void> {
    const isConfigured = await isGitConfiguredForMultiEnv(rootPath)

    if (isConfigured) {
      outputSuccess('✅ Git is configured for multi-environment theme development')
      outputInfo('Merging between environment branches will preserve environment-specific settings')
    } else {
      outputWarn('⚠️  Git is not configured for multi-environment theme development')
      outputInfo('Run "shopify theme git-setup --multi-environment" to eliminate merge conflicts')
    }
  }

  private async showNextSteps(): Promise<void> {
    outputInfo('')
    outputInfo('🎉 Setup complete! Your Git repository now supports conflict-free multi-environment merges.')
    outputInfo('')
    outputInfo('Next steps:')
    outputInfo(
      '  1. Commit your .gitattributes changes: git add .gitattributes && git commit -m "Add multi-env Git config"',
    )
    outputInfo('  2. Test the setup: Create branches for your environments (dev, staging, prod)')
    outputInfo('  3. Make changes and merge between branches - conflicts should be resolved automatically!')
    outputInfo('')
    outputInfo('💡 Environment-specific settings will be preserved during merges')
    outputInfo('💡 Code changes will merge normally across all environments')
  }
}
