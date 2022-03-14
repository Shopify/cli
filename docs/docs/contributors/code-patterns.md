---
title: Code patterns
---

Having conventions around code patterns **makes a codebase easy to navigate and work with**.
You get free when you use opinionated frameworks like [Rails](https://rubyonrails.org/),
but you need to come up with otherwise if you don't use a framework
The Shopify CLI doesn't have a framework,
and therefore it's our responsibility to **define and ensure that patterns** are followed.
What follows is the set of patterns that you'll find across the codebase and that we require contributors to follow.

## Model-command-service (MCS)

This pattern is a map of the well-known [model-view-controller](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller) to the domain of a CLI.

### Command (View)

#### Definition and responsibilities

Commands are akin to views in MVC.
They represent the interface users interact with.
Unlike web or mobile apps,
where a view has a graphic representation,
commands represent users' intents and describe how users can invoke them.
A command is represented by a name, description, and a set of flags and arguments that users can pass.
Their responsibility is **parsing and validating arguments and flags.**
Business logic must be delegated to services that represent units of business logic.

#### Naming and directory conventions

The commands' hierarchy is laid out inside the `src/cli/commands` directory. Every subdirectory represents a level of commands, and the command's name matches the file name. Below there's an example of the file structure that we need for the `shopify app build` command:

```
app/
  src/
    cli/
      commands/
        build.ts
```

#### Resources

- [How to define commands using oclif classes](https://oclif.io/docs/commands)
- [How to declare command arguments](https://oclif.io/docs/args)
- [How to declare flags](https://oclif.io/docs/flags)

### Service (Controller)

#### Definition and responsibilities

Services represent **reusable units of business logic.**
They export a default function representing the service and might contain additional internal combined functions to form the service.
Each command must have a service representing it,
and we might have additional services that don't map to commands.
Note that services are decoupled from commands,
so they have no knowledge of flags and arguments.
They usually take an options object that aligns with the command's flags.

```ts
// commands/serve.ts
import devService from "../services/dev"

export default class Dev extends Command {
  static description = 'Dev the app'

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Dev)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app = loadApp(directory)
    await devService({app, port: flags.port})
  }
}
```

#### Naming and directory conventions

```
app/
  src/
    cli/
      services/
        build.ts # For the build command
```

## Additional patterns

### Prompts

### Utilities
