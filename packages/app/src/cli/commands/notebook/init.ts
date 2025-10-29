import {selectOrg} from '../../services/context.js'
import {selectOrCreateApp} from '../../services/dev/select-app.js'
import {selectDeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {OrganizationApp} from '../../models/organization.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {AbortError} from '@shopify/cli-kit/node/error'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderInfo, renderSuccess, renderConfirmationPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {exec} from '@shopify/cli-kit/node/system'
import {hyphenate} from '@shopify/cli-kit/common/string'
import {cwd, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {fileExists, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {Flags} from '@oclif/core'

export default class NotebookInit extends BaseCommand {
  static summary = 'Initialize a Python notebook project linked to a Shopify app'

  static flags = {
    ...globalFlags,
    path: Flags.string({
      char: 'p',
      env: 'SHOPIFY_FLAG_PATH',
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
      hidden: false,
    }),
  }

  async run(): Promise<{app: OrganizationApp}> {
    const {flags} = await this.parse(NotebookInit)

    // 1) Select organization
    const org = await selectOrg()
    const developerPlatformClient = selectDeveloperPlatformClient({organization: org})
    const {apps} = await developerPlatformClient.orgAndApps(org.id)

    // 2) Ask whether to create a new app (and ask for name if needed)
    const createNew = await renderConfirmationPrompt({
      message: 'Create this project as a new app on Shopify?',
      confirmationMessage: 'Yes',
      cancellationMessage: 'No',
    })

    let app: OrganizationApp
    if (createNew) {
      const name = await renderTextPrompt({
        message: 'App name',
        defaultValue: 'notebook-app',
      })
      app = await developerPlatformClient.createApp(org, {name, isLaunchable: false})
    } else {
      if (apps.length === 0) {
        throw new AbortError('No apps found in this organization. Rerun and choose to create a new app.')
      }
      // Use the first available app without additional prompts to honor the 2-question requirement
      const selected = apps[0]!
      const full = await developerPlatformClient.appFromIdentifiers(selected.apiKey)
      if (!full) throw new AbortError(`App with id ${selected.id} not found`)
      app = full
    }

    // 3) Create project folder
    const folderName = hyphenate(app.title)
    const projectRoot = joinPath(flags.path as string, folderName)
    if (await fileExists(projectRoot)) {
      throw new AbortError(
        `\nA directory with this name (${folderName}) already exists.\nChoose a new name for your project.`,
      )
    }
    await mkdir(projectRoot)

    // 4) Write .env with SHOPIFY_API_KEY/SHOPIFY_API_SECRET
    const apiKey = app.apiKey
    const apiSecret = app.apiSecretKeys?.[0]?.secret ?? ''
    const envContent = `SHOPIFY_API_KEY=${apiKey}\nSHOPIFY_API_SECRET=${apiSecret}\n`
    await writeFile(joinPath(projectRoot, '.env'), envContent)
    // Also set for the current process so subsequent child processes can read them if needed
    process.env.SHOPIFY_API_KEY = apiKey
    process.env.SHOPIFY_API_SECRET = apiSecret

    // 5) Initialize a new uv environment inside the folder
    renderInfo({
      body: ['Creating Python environment with ', {command: 'uv venv'}],
    })
    try {
      await exec('uv', ['venv'], {cwd: projectRoot, stdio: 'inherit'})
    } catch {
      throw new AbortError(
        'Failed to create a virtual environment with uv. Please install uv (https://docs.astral.sh/uv/) and try again.',
      )
    }

    // 6) Initialize uv project & install Python dependencies into the created environment
    {
      const pythonBin = process.platform === 'win32' ? 'python.exe' : 'python'
      const venvPython = joinPath(projectRoot, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', pythonBin)

      // Create a uv project to enable lockfile generation (uv.lock)
      renderInfo({body: ['Initializing project with ', {command: 'uv init'}]})
      try {
        await exec('uv', ['init'], {cwd: projectRoot, stdio: 'inherit'})
      } catch {
        throw new AbortError('Failed to initialize project with uv (uv init).')
      }

      renderInfo({body: ['Installing ', {userInput: 'jupyterlab'}, ' with ', {command: 'uv pip'}]})
      try {
        // Use uv add to create/refresh uv.lock
        await exec('uv', ['add', '--python', venvPython, 'jupyterlab'], {
          cwd: projectRoot,
          stdio: 'inherit',
        })
      } catch {
        throw new AbortError('Failed to install jupyterlab with uv (uv add jupyterlab).')
      }

      // Add seaborn package
      renderInfo({body: ['Installing ', {userInput: 'seaborn'}, ' with ', {command: 'uv pip'}]})
      try {
        await exec('uv', ['pip', 'install', 'seaborn'], {cwd: projectRoot, stdio: 'inherit'})
      } catch {
        throw new AbortError('Failed to install seaborn with uv (uv pip install seaborn).')
      }

      const localPkgPath = '/Users/weirdpipo/src/github.com/Shopify/merchant-analytics-api/py_public/shopifyql'
      if (await fileExists(localPkgPath)) {
        renderInfo({
          body: ['Installing local package in editable mode: ', {userInput: localPkgPath}],
        })
        try {
          // Use uv add --editable to update uv.lock
          await exec('uv', ['add', '--python', venvPython, '--editable', localPkgPath], {
            cwd: projectRoot,
            stdio: 'inherit',
          })
        } catch {
          throw new AbortError('Failed to install local package with uv (uv add --editable <path>).')
        }
      } else {
        renderInfo({
          body: [
            'Local package not found at ',
            {userInput: localPkgPath},
            '. If desired, install it later with ',
            {command: `uv add --python ${venvPython} --editable ${localPkgPath}`},
          ],
        })
      }

      // Best-effort lock refresh
      try {
        await exec('uv', ['lock'], {cwd: projectRoot, stdio: 'inherit'})
      } catch {}
    }

    // 7) Create a starter notebook
    const notebooksDir = joinPath(projectRoot, 'notebooks')
    await mkdir(notebooksDir)
    const nb = {
      cells: [
        {
          cell_type: 'markdown',
          metadata: {},
          source: ['# Welcome to your Shopify Notebook\n', '\n', 'Your environment variables are in `.env`.\n'],
        },
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [
            'from shopifyql import ShopifyQLClient\n',
            'SHOP = ""  # The shop we are going to query\n',
            'client = ShopifyQLClient(shop=SHOP)\n',
            'client.authenticate()\n',
            'client.query("from sales show total_sales")',
          ],
        },
      ],
      metadata: {
        kernelspec: {display_name: 'Python 3', language: 'python', name: 'python3'},
        language_info: {name: 'python'},
      },
      nbformat: 4,
      nbformat_minor: 5,
    }
    const nbPath = joinPath(notebooksDir, 'GettingStarted.ipynb')
    await writeFile(nbPath, JSON.stringify(nb, null, 2))

    // 8) Provide next steps
    renderSuccess({
      headline: [{userInput: folderName}, ' is ready for you to build!'],
      nextSteps: [
        ['Run', {command: `cd ${folderName}`}],
        ['Activate the environment', {command: 'source .venv/bin/activate'}],
        ['Inspect your credentials', {command: 'cat .env'}],
        ['Launch JupyterLab', {command: 'jupyter lab notebooks/GettingStarted.ipynb'}],
      ],
    })

    return {app}
  }
}
