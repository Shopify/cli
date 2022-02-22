import {CheckResult} from '../../../../../types'
import addEslint from '../../../add/eslint'
import Command from '../../../../../core/Command'

export async function checkEslintConfig(this: Command): Promise<CheckResult[]> {
  const eslintConfig = await this.workspace.loadConfig<{extends: string[]}>(
    'eslint',
  )

  const hasEslintConfig = Boolean(eslintConfig)

  const hasHydrogenConfig =
    hasEslintConfig &&
    Boolean(
      eslintConfig.config.extends?.filter((extended: string) =>
        extended.includes('plugin:hydrogen'),
      ).length,
    )

  const hasHydrogenEslintPackage = Boolean(
    await this.package.hasDependency('eslint-plugin-hydrogen'),
  )

  return [
    {
      id: 'eslint-config',
      type: 'Setup',
      description: 'Has eslint config',
      success: hasEslintConfig,
      link: 'https://shopify.dev/custom-storefronts/hydrogen/lint',
      fix: addEslint,
    },
    {
      id: 'eslint-config-hydrogen',
      type: 'Setup',
      description: 'Has hydrogen eslint config',
      success: hasHydrogenConfig && hasHydrogenEslintPackage,
      link: 'https://shopify.dev/custom-storefronts/hydrogen/lint',
      fix: addEslint,
    },
  ]
}
