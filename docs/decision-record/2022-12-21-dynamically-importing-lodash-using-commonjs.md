# Dynamically importing Lodash using CommonJS

The standard module system in Javascript, [ESM](https://hacks.mozilla.org/2018/03/es-modules-a-cartoon-deep-dive/), loads the dependency graph statically before executing any code. Because loading every module entails doing an IO and parsing operations, the more significant the graph is, the more the CLI takes to load.
The above is not a problem that the server of frontend Javascript projects experiences. In the case of the former, the time a server takes to boot is irrelevant. The deployment tools wait until the server runs to send traffic to it. In frontend projects, the modules are usually smashed into a bundle using tools like Webpack or Vite. In the case of a CLI, users expect a startup time of hundreds of milliseconds.
Because of the above, we need to be mindful when adding third-party dependencies whose module graph is built on the assumption that module load time is unimportant. An excellent example is `lodash-es`, which we introduced in some of the packages in the repo. Imports like the following lead to importing all the utilities even if we are only using one of them:

```js
import { groupBy } from 'lodash-es'
```

We recommend not introducing third-party dependencies unless it's strictly necessary. For example, when the dependency is significant and is actively contributed to (e.g., Vite). If we need to introduce the dependency, we should look into how they export their modules. If they use [subpath exports](https://nodejs.org/api/packages.html#subpath-exports), we can add static imports and import only the utilities we need. If not, we should resort to dynamic imports that lazily import the module when needed:

```js
const foo = await import("bar") // Lazily-imported
```

Note that the above will make the functions that wrap the code asynchronously. This was undesirable in the case of `lodash` for functions like `mapValues`. Therefore we decided to use the CommonJS version of the package and use `require` to require the utilities synchronously.


