# Shopify CLI Extensions

`shopify-cli-extensions` is an add-on to the Shopify CLI. Today, its main purpose is to power the experience of `shopify extension serve`, `shopify extension build` and augment `shopify extension create`. However, we will consider expanding its responsibilities in future.

## Getting started

To run the tests, simply execute the following shell command:

```sh
make test
```

To run the server, simply execute the following shell command:

```sh
make run serve < testdata/shopifile.yml
```

Subsequently, you should be able to retrieve sample assets as follows:

```sh
curl http://localhost:8000/extensions/00000000-0000-0000-0000-000000000000/assets/index.js
```

## Technical Design

- _Vault Project_: https://vault.shopify.io/projects/20476
- _Slack channel_: #shopify-cli-extensions
- _Project champion:_ Konstantin Tennhard (@t6d)

### Background

Currently, we use a combination of Webpack and Babel for compilation and Webpack Dev Server to serve the compilation artifacts. This solution provides a few challenges:

- Webpack Dev Server has known security vulnerabilities,
- Babel, Webpack and Webpack Dev Server have many external dependencies, and
- Serving an extension requires a Node process that occupies a port.

As long as projects are comprised of a single extension, having a dedicated Node server doesn't pose major challenges. However, as soon as we're trying to run multiple extensions, two major challenges arise:

1. Port selection needs to be centrally coordinated,
1. Making all servers externally available through an HTTP tunnel requires an additional reverse proxy server.

Serving an extension using a dedicated Node server is acceptable as long as projects do not consist of more than one extension, however, in the realm of workspaces, problems arising from different development environment configurations as well as running several servers are multiplied.

Instead of deploying yet another piece of development infrastructure that distributes traffic to the correct Node server, we've been exploring a solution that allows us to ship a single server that coordinates all work.

The prototype can be found here: https://github.com/Shopify/app-extension-experiments/tree/master/esbuild-extension-server

### Scope

Our goal is to produce a statically linked command line tool, `shopify-extensions` that has zero dependencies. Its main responsibilities are

1. executing the JavaScript compilation and bundle generation using ESBuild,
2. serving build artifacts to the client via a HTTP API,
3. aid client-side extension hot reloading by communicating the build status of the latest build via web sockets, and
4. generate the extension project scaffold whenever `shopify extension create` is executed.

Lastly, the binary has to be integrated into the Shopify CLI. We're planning to download the the OS and CPU architecture appropriate binary. Based on our goals and requirements, we chose Go as implementation platform for the following reasons:

- Go is already being used at Shopify,
- Go is highly performant,
- Go is is easy to learn,
- Go can easily be cross-compiled and yields statically linked binaries with zero runtime dependencies,
- Go binaries support embedding of assets such as JS, CSS, HTML files
- Go has excellent support for concurrent programming and thus yields itself to process orchestration,
- Go has a vast standard library including excellent support for writing HTTP servers and proxy servers.

Furthermore, we picked ESBuild for the following reasons:

- ESBuild can provide build times 10-100x faster than Webpack,
- ESBuild can transpile the extension JS bundle without pulling in any additional dependencies (ex. Babel and its plugins)

During our prototype we observed speed improvements of 175x. Compile time dropped from 6 seconds to 35 milliseconds.

#### Compiling and bundling JavaScript

The build process runs independently from `shopify-extensions` but is coordinated by the latter. Meaning, `shopify-extensions` will be responsible for starting, stopping and monitoring the build processes. The API contract, between the build process and `shopify extensions` is simple:

- the build process is started through a `build` script in `package.json`, which is invoked through either `yarn` or `npm`,
- the build process is expected to run continuously until terminated,
- the build process is expected to watch the extension source directory (`src/` by default) for changes and recompile automatically,
- the build process is expected to read from the configurable source directory (`src/` by default) and write any produced artifacts into a configurable build directory (`build/` by default),
- the build process is expected to signal build failures by writing to standard error.

The default build process will be based on ESBuild and configured through `./build.js`. However, as long as developers satisfy above constraints, they can freely customize the build process by either editing `./build.js` or completely overriding the build script in `./package.json`.

Process orchestration in `shopify-extensions` CLI is accomplished using Go routines and [`exec.CommandContext`](https://pkg.go.dev/os/exec#example-Command) using `CommandContext` instead of `Command` allows us to use Go's [`context`](https://pkg.go.dev/context) package for managing process termination.
To detect updates to the build artifacts produced by the external build process, we are using [`fsnotify`](https://pkg.go.dev/github.com/fsnotify/fsnotify), a cross-platform file-system watcher implementation.
`shopify-extensions` will be designed from the get go to support multiple extensions.

#### Serving build artifacts

On top of being responsible for build process coordination, `shopify-extensions` will also implement an HTTP and Websocket API to serve build artifacts and aid hot reloading:

- `GET /extensions` will return the list of extensions under development and support upgrading the connection to a web socket connection to enable clients to subscribe to build status updates,
- `PATCH /extensions` will enable clients to update extension settings (e.g. whether they are visible) and provide additional information that is only available at runtime (e.g. more information on the app)
- `GET /extensions/:uuid` will respond with an error page if accessed via HTTP instead of HTTPS. Otherwise, it will either redirect to the location where the extension is mounted or display further instructions.

In order for the host (Web/Mobile Admin or Checkout) to perform hot-reloading of extensions, it needs to establish a web socket connection through `/extensions`. It will then receive a message for every time any build process fails or finishes successfully.

##### Integration with Shopify CLI

Various pieces for integration with the Shopify CLI are still a work in process. In a nutshell, the desired vision for integrating with the Shopify CLI is as follows:

- during the Shopify CLI installation, we will download the OS and CPU architecture appropriate binary of `shopify-extensions` from Github and place it next to the `shopify` bin stub that is being created by the Shopify CLI through `ext/shopify-cli/extconf.rb`,
- The Shopify CLI will be responsible for parsing the `.env` and `shopify-cli.yml` files for the relevant data the `shopify-cli-extensions` package will need.
- all configuration information required by `shopify-extensions` will be forwarded from the Ruby process via standard input in YAML format when it starts `shopify-extensions`.

#### Scaffolding

`shopify-extensions` isn't just responsible for carrying out the majority of work when a developer run `shopify extensions server`, it's also responsible for generating an initial project structure when developers run `shopify extension create`. To that end, the binary will inline all assets in `templates/` and organize them in a virtual file system. Asset embedding is natively supported by Go through [`embed`](https://pkg.go.dev/embed). Asset embedding allows us to meet our goal of shipping a binary that has no external dependencies. It further avoids calls to Github during the creation of an extension, which results in faster project bootstrapping and reduces the number of potential failure points.

### Open questions / issues

- We may need to support both `ArgoServe` (legacy way of serving extensions) and the `shopify-cli-extensions` package for a pre-determined period of time to give Partners enough time to move to the new version
