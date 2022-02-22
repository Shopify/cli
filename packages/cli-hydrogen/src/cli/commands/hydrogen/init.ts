import degit from 'degit'
import {underline, yellow} from 'chalk'
import {ui} from '@shopify/cli-kit'

import cliPackageJson from '../../../../../cli/package.json'
import cliHydrogenPackageJson from '../../../../package.json'
import Command, {Flags} from '../../core/Command'

export enum Template {
  Minimum = 'Minimal Hydrogen starter',
  Default = 'Default Hydrogen demo',
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const TEMPLATE_MAP: {[key: Template]: string} = {
  [Template.Default]: 'Shopify/hydrogen/examples/template-hydrogen-default',
  [Template.Minimum]: 'Shopify/hydrogen/examples/template-hydrogen-minimum',
}

const RENAME_MAP = {
  _gitignore: '.gitignore',
}

export default class Init extends Command {
  static args = [{name: 'name', description: 'Root of the project'}]
  static flags = {
    root: Flags.string({
      char: 'r',
      description: 'Root directory of the project.',
    }),
    local: Flags.boolean({
      char: 'l',
      description: 'Use local hydrogen',
    }),
  }

  async run() {
    const {args, flags} = await this.parse(Init)
    const questions: ui.Question[] = []
    let name = args.name
    if (!name) {
      name = (
        await ui.prompt<{name: string}>([
          {
            name: 'name',
            type: 'input',
            default: 'snow-devil',
            message: 'What do you want to name this app?',
          },
        ])
      ).name
    }
    let root = args.root
    if (!root) {
      root = (
        await ui.prompt<{root: string}>([
          {
            name: 'root',
            type: 'input',
            default: `./${name}`,
            message: 'Where do you want to generate this app?',
          },
        ])
      ).root
    }

    if (!args.root) {
      questions.push({
        name: 'root',
        type: 'input',
        default: 'snow-devil',
        message: 'Where do you want to generate this app?',
      })
    }

    this.name = name
    this.root = root || name

    if (await this.fs.hasDirectory(this.root)) {
      const overwrite = await this.interface.ask(
        `${this.root} is not an empty directory. Do you want to remove the existing files and continue?`,
        {boolean: true, name: 'overwrite', default: false},
      )

      if (overwrite) {
        await this.fs.remove(this.root)
      }
    } else {
      await this.fs.makeDirectory(this.root)
    }

    const template = await this.interface.ask<Template>('Pick a template', {
      choices: [Template.Default, Template.Minimum],
      name: 'template',
    })

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const templateSource: string = TEMPLATE_MAP[template]

    const emitter = degit(templateSource, {
      force: true,
      verbose: true,
    })

    await emitter.clone(`${this.root}/tmp`)

    const rootTmp = `${this.root}/tmp`
    const files = await this.fs.glob(`${rootTmp}/**/*`, {
      dot: true,
      onlyFiles: true,
    })

    for (const sourceFile of files) {
      const fileName = this.fs.relativePath(sourceFile, rootTmp)
      const finalFilename =
        RENAME_MAP[fileName as keyof typeof RENAME_MAP] ?? fileName
      const destPath = sourceFile
        .replace(rootTmp, this.root)
        .replace(fileName, finalFilename)

      const overwritten = await this.fs.hasFile(destPath)
      await this.fs.copy(sourceFile, destPath)

      this.interface.printFile({
        path: this.fs.relativePath(destPath, process.cwd()),
        overwritten,
      })
    }

    // Refresh package.json
    this.package.name = name
    const cliDependencies: {[key: string]: string} = {}
    cliDependencies[cliHydrogenPackageJson.name] =
      cliHydrogenPackageJson.version
    cliDependencies[cliPackageJson.name] = cliPackageJson.version
    this.package.addDependencies(cliDependencies)

    if (flags.local) {
      this.package.install('@shopify/hydrogen', {
        version: 'file:../../Shopify/hydrogen/packages/cli-hydrogen',
      })
    }

    await this.package.write()

    console.log()
    this.interface.say(
      `${underline('Success!')} Created app in ${yellow(
        `/${this.fs.relativePath(this.root, process.cwd())}`,
      )}.`,
    )
    this.interface.say(`Run the following commands to get started:`)
    console.log()
    if (this.root !== process.cwd()) {
      this.interface.say([
        [
          ` • cd ${this.fs.relativePath(this.root, process.cwd())}`,
          'change into the project directory',
        ],
      ])
    }

    const usesYarn = this.package.packageManager === 'npm'
    this.interface.say([
      [
        ` • ${usesYarn ? `yarn` : `npm install --legacy-peer-deps`}`,
        '         install the dependencies',
      ],
      [` • ${usesYarn ? `yarn` : `npm run`} dev`, '     start the dev server'],
    ])
    console.log()
    console.log()
    console.log()
  }
}

function validateProjectName(name: string) {
  const packageNameRegExp =
    /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/

  if (packageNameRegExp.test(name)) {
    return true
  }

  const suggested = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9-~]+/g, '-')

  return `Invalid package.json name. Try ${suggested} instead.`
}
