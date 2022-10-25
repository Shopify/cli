# Conventions

Having conventions around code patterns **makes a codebase easy to navigate and work with**. You get it for free when you use opinionated frameworks like Rails, but the Shopify CLI doesn't have a framework, and therefore it's our responsibility to **define and ensure that patterns are followed**. What follows is the set of patterns that you'll find across the codebase and that we require contributors to follow.

## 1 - All packages

### 1.1 - Named over default exports

Default exports force the module importer to decide on a name, which leads to inconsistencies and thus makes a codebase harder to navigate. Use named exports and make it explicit in the name of the domain the function belongs to. The following API from Node is a bad example because it's hard to know the meaning of `join` far from the `import` context:

```ts
import { join } from "node:path"
```

A better name for the above function would have beeen:

```ts
import { joinPath } from "node:path"
```


### 1.2 - Modules free of side effects

Modules must not perform any side effect when they are imported. For example, doing an IO operation at the root of the module:

```ts
// some-module.ts

import { fs } from "node:fs"

const content = fs.readSync("./package.json")
```

Modules with side effects might increase the load time of the dependency graph and complicate writing tests and reasoning about the code.

### 1.3 - Stateless modules

Don't use modules to store state at runtime. Due to how Node module resolution works, we don't have control over how package managers organize modules in the filesystem. Therefore, projects might end up with more than one copy of a module (and its state) in the dependency graph, which can lead to unexpected behaviors. For example:

```ts
// store.ts

const isInitialized = false;
```

Instead, you can:
- **Store the state in the system.** It leads to IO operations, which impact the performance, but because the state is often little, it's preferred over an unreliable experience.
- **Load and pass the state down:** Load the state upfront, for example, an in-memory representation of the project the CLI is interacting with, and pass it down through function arguments.

### 1.4 - Functions that don't mutate the input arguments

When designing the implementation of a function, refrain from mutating objects that the function receives as arguments. Function callers might design their business logic to assume that the arguments they pass to other functions are not mutated. If they do, the integration might not behave as expected, manifesting as bugs on the user side.

```ts
// Bad pattern
optimize(app)

// Better pattern
const optimizedApp = optimize(app)
```

Note that copies come with an overhead in memory consumption,
but considering the size of the state, the CLI deals with, and optimizations Javascript engines usually include,
it shouldn't be an issue.


## 2 - Plugins (e.g `@shopify/app`)

### 2.1 - Model-command-service (MCS)

This pattern is a map of the well-known [model-view-controller](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller) to the domain of a CLI.

#### Command (View)

##### Definition and responsibilities

Commands are akin to views in MVC.
They represent the interface users interact with.
Unlike web or mobile apps,
where a view has a graphic representation,
commands represent users' intents and describe how users can invoke them.
A command is represented by a name, description, and a set of flags and arguments that users can pass.
Their responsibility is **parsing and validating arguments and flags.**
Business logic must be delegated to services that represent units of business logic.

##### Naming and directory conventions

The commands' hierarchy is laid out inside the `src/cli/commands` directory. Every subdirectory represents a level of commands, and the command's name matches the file name. Below there's an example of the file structure that we need for the `shopify app build` command:

```
app/
  src/
    cli/
      commands/
        build.ts
```

##### Resources

- [How to define commands using oclif classes](https://oclif.io/docs/commands)
- [How to declare command arguments](https://oclif.io/docs/args)
- [How to declare flags](https://oclif.io/docs/flags)

#### Service (Controller)

##### Definition and responsibilities

Services represent **reusable units of business logic.**
They export a default function representing the service and might contain additional internal combined functions to form the service.
Each command must have a service representing it,
and we might have additional services that don't map to commands.
Note that services are decoupled from commands,
so they do not know of flags and arguments.
They usually take an options object that aligns with the command's flags.

```ts
// commands/serve.ts
import { devService } from "../services/dev"

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

##### Naming and directory conventions

Services live under the `services` directory inside `cli`. For services that represent a command's business logic, the name must match the name of the command represent.

```
app/
  src/
    cli/
      services/
        build.ts # For the build command
```

#### Model

##### Definition and responsibilities

It is the application's dynamic data structure.
They are represented by a class or a [Typescript interface](https://www.typescriptlang.org/docs/handbook/interfaces.html) or type that a Javascript object can implement.
If a model is scoped to a particular file, it can be defined at the top of the file.
For example, some models are internal to services.
However, suppose the model is core to the domain the package represents, for example, App. In that case, it must live in its own file that represents it.

> :exclamation: **Models and business logic**
>
> It might feel tempting to add business logic to models. Refrain from doing it. A model is an object with whom the business logic operates. For example, if we have business logic for loading and validating an app, we'll have that function. The output will be the model ready to pass to other components down the process.
>
> The model can contain convenient getters and setters to interact with the model.

#### Naming and directory conventions

Models live in the `models` directory under `cli`:

```
app/
  src/
    cli/
      models/
        app.ts
```

### 2.2 - Additional patterns

Some additional patterns have emerged over time and that don't fit any of the MCS groups:

- **Prompts:** Prompts are a particular type of service that prompts the user, collects, and returns the responses as a Javascript object. We recommend creating them under the `prompts/` directory.
- **Utilities:** Utilities represent a sub-domain of responsibilities. For example, we can have a `server` utility that spins up an server to handle HTTP requests.

## 3 - @shopify/cli-kit

### 3.1 - Public and private modules

**Public** modules must live in the `src/public` directory in any of the following sub-directories:

- `node`: For modules that are dependent on the Node runtime.
- `browser` For the modules that are dependent on the browser runtime.
- `common`: For modules that are runtime-agnostic.

The sub-organization helps clarify the runtime the functions exported by the module can run. For example, if we provide utilities for manipulating arrays, we'd create them in a `src/public/common/array.ts` module, and the consumers of the `@shopify/cli-kit` package would import them as:

```ts
import { getArrayHasDuplicates } from "@shopify/cli-kit/common/array"
```

**Private** modules must live in the `src/private` directory using the same above subdirectories: `node`, `browser`, `common`.

### 3.2 - Document public modules

Most IDEs integrate the code documentation to enrich developers' experience writing code. Let's ensure we enable that experience for the developers using `@shopify/cli-kit` and ensure the exported elements from the public modules are documented following the [JSDoc](https://jsdoc.app/) standard.
