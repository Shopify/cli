# Shopify CLI Extensions

`shopify-cli-extensions` is an add-on to the Shopify CLI. Today, its main purpose is to power the experience of `shopify extension serve`, `shopify extension build` and augment `shopify extension create`. However, we will consider expanding its responsibilities in future.

## Getting started

To run the tests, simply execute the following shell command:

```sh
make test
```

To run the server, simply execute the following shell command:

```sh
make run
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

Our goal is to produce a statically linked binary with zero dependencies that is responsible for

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

During our prototype we observed speed improvements of 200x. Compile time dropped from 6 seconds to 35 milliseconds.

#### Compiling and bundling JavaScript

The build process will have the following major components:

- A `build.js` file which will contain the configuration needed to build the extension with esbuild
- An `npm|yarn run build` command, which will call the `build.js` file
- A Go function that will spin up a Node process that will call on `npm|yarn run build`
- This will require a Golang wrapper to be able to interface with both `npm` and `yarn` seamlessly

Developers will have the ability to fully customize the build process by either tweaking the `build.js` file or changing the `build` script in the `package.json` file to something else entirely.

#### Serving build artifacts

The server process will be built in Go due to its proven high performance and ability to handle multiple threads of work, which will make it easy to run multiple extensions at once (with an eye for future-proofing this tool).

The server will be responsible for two major things:

- Parsing configuration options from the Shopify CLI via STDIN (could be via persisted file in the future, or if there is time)
- Watching for changes in the `/build` directory, building (more on build process below), and serving the changes.

The server will expose several REST APIs (TBD):

`GET /extensions/`: list of extensions available in the current project / workspace.
`GET /extensions/:uuid`: get a single extension by registration UUID, redirects to tunnel
`GET /extensions/:uuid/stats|data`: get stats or data for an extension given a UUID

##### Integration with Shopify CLI

Various pieces for integration with the Shopify CLI are still a work in process. In a nutshell, the desired vision for integrating with the Shopify CLI is as follows:

- during the Shopify CLI installation, we will download the OS and CPU architecture appropriate binary of `shopify-cli-extensions` from Github and place it next to the `shopify` bin stub that is being created by the Shopify CLI through `ext/shopify-cli/extconf.rb`,
- The Shopify CLI will be responsible for parsing the `.env` and `shopify-cli.yml` files for the relevant data the `shopify-cli-extensions` package will need.

### Open questions / issues

- We may need to support both `ArgoServe` (legacy way of serving extensions) and the `shopify-cli-extensions` package for a pre-determined period of time to give Partners enough time to move to the new version
- Need to look into includig extension templates as part of the `shopify-cli-extensions` binary, so that the executable always has access to a compatible template in order to avoid compatibility issues when changes to the template are made
