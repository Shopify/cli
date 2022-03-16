---
title: Code patterns
---

Having conventions around code patterns **makes a codebase easy to navigate and work with**. You get free when you use opinionated frameworks like Rails, but that you need to come up with if you don't use a framework. The Shopify CLI doesn't have a framework, and therefore it's our responsibility to **define and ensure that patterns are followed**. What follows is the set of patterns that you'll find across the codebase and that we require contributors to follow.

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
so they do not know of flags and arguments.
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

Services live under the `services` directory inside `cli`. For services that represent a command's business logic, the name must match the name of the command represent.

```
app/
  src/
    cli/
      services/
        build.ts # For the build command
```

### Model

#### Definition and responsibilities

It is the application's dynamic data structure.
They are represented by a class or a [Typescript interface](https://www.typescriptlang.org/docs/handbook/interfaces.html) or type that a Javascript object can implement.
If a model is scoped to a particular file, it can be defined at the top of the file.
For example, some models are internal to services.
However, suppose the model is core to the domain the package represents, for example, App. In that case, it must live in its own file that represents it.

:::caution Models and business logic
It might feel tempting to add business logic to models. Refrain from doing it. A model is an object with whom the business logic operates. or example, if we have business logic for loading and validating an app, we'll have that function. The output will be the model ready to pass to other components down the process.

The model can contain convenient getters and setters to interact with the model.
:::

#### Naming and directory conventions

Models live in the `models` directory under `cli`:

```
app/
  src/
    cli/
      models/
        app.ts
```

## Additional patterns

Some additional patterns have emerged over time and that don't fit any of the MCS groups:

- **Prompts:** Prompts are a particular type of service that prompts the user, collects, and returns the responses as a Javascript object. We recommend creating them under the `prompts/` directory.
- **Utilities:** Utilities represent a sub-domain of responsibilities. For example, we can have a `server` utility that spins up an server to handle HTTP requests.
