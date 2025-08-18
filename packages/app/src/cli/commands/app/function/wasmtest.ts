import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {runFunctionTestsIfExists} from '../../../services/function/test-runner.js'
import {appFlags} from '../../../flags.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {buildFunctionExtension} from '../../../services/build/extension.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {glob} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {readFileSync, writeFileSync, existsSync} from 'fs'
import {createHash} from 'crypto'

export default class FunctionWasmtest extends AppLinkedCommand {
  static summary = 'Builds the function and runs all tests in the test folder.'

  static descriptionWithMarkdown = `Builds the function to WebAssembly and then automatically runs tests if a \`tests\` folder exists. This is useful for ensuring your function works correctly before deployment.

If a test command is specified in your \`shopify.extension.toml\` file under \`[extensions.test]\`, that command will be used instead of the default vitest runner:

\`\`\`toml
[[extensions]]
name = "my-function"
handle = "my-function"
type = "function"

  [extensions.test]
  command = "npx vitest run"
\`\`\`

If no custom test command is found, the command will automatically discover and run \`.test.ts\` and \`.test.js\` files using vitest.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    'api-key': Flags.string({
      hidden: true,
      description: "Application's API key",
      env: 'SHOPIFY_FLAG_API_KEY',
      exclusive: ['config'],
    }),
    'skip-build': Flags.boolean({
      description: 'Skip building the function and just run tests.',
      env: 'SHOPIFY_FLAG_SKIP_BUILD',
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(FunctionWasmtest)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'] ?? flags['api-key'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)

    if (!flags['skip-build']) {
      const shouldBuild = await this.shouldRebuild(ourFunction.directory)
      if (shouldBuild) {
        const startTime = Date.now()
        outputInfo('🔨 Building function...')

        await buildFunctionExtension(ourFunction, {
          stdout: process.stdout,
          stderr: process.stderr,
          app,
          environment: 'production',
        })

        const endTime = Date.now()
        const duration = (endTime - startTime) / 1000

        // Save hash after successful build
        await this.saveSourceHash(ourFunction.directory)
        outputInfo(`✅ Function built successfully in ${duration.toFixed(2)}s`)
      } else {
        outputInfo('✅ Function is up to date, skipping build')
      }
    }

    await runFunctionTestsIfExists(ourFunction, {
      stdout: process.stdout,
      stderr: process.stderr,
    })

    return {app}
  }

  private async getSourceHash(functionPath: string): Promise<string> {
    const sourceDir = joinPath(functionPath, 'src')
    const configFile = joinPath(functionPath, 'shopify.extension.toml')
    const packageFile = joinPath(functionPath, 'package.json')

    // Get all source files and config files that could affect the build
    const sourceFiles = await glob('**/*.{ts,js}', {cwd: sourceDir, absolute: true})
    const configFiles = [configFile, packageFile].filter(existsSync)

    const hash = createHash('md5')

    // Hash source files
    for (const file of sourceFiles.sort()) {
      const content = readFileSync(file)
      hash.update(content)
    }

    // Hash config files
    for (const file of configFiles) {
      const content = readFileSync(file)
      hash.update(content)
    }

    return hash.digest('hex')
  }

  private async shouldRebuild(functionPath: string): Promise<boolean> {
    const hashFile = joinPath(functionPath, '.source-hash')
    const currentHash = await this.getSourceHash(functionPath)

    if (!existsSync(hashFile)) {
      return true
    }

    try {
      const storedHash = readFileSync(hashFile, 'utf-8').trim()
      return currentHash !== storedHash
    } catch {
      return true
    }
  }

  private async saveSourceHash(functionPath: string): Promise<void> {
    const hashFile = joinPath(functionPath, '.source-hash')
    const currentHash = await this.getSourceHash(functionPath)

    try {
      writeFileSync(hashFile, currentHash)
    } catch (error) {
      // Don't fail the build if we can't save the hash
      outputInfo('⚠️  Could not save source hash for future builds')
    }
  }
}
