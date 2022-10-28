# Cross-OS compatibility

The CLI must support Windows, Linux, and macOS.
Supporting the three OSs has implications in how the code is written and tested. This document includes some guidelines to ensure the CLI works reliably across OS and that we don't introduce regressions.

## Developing

### Use `@shopify/cli-kit` modules

Unlike programming languages like Rust or Go, whose standard library work more consistently across OS, that's not the case with the Node runtime in which the CLI runs. Consequently, packages like [cross-zip](https://www.npmjs.com/package/cross-zip), [execa](https://www.npmjs.com/package/execa), or [pathe](https://www.npmjs.com/package/pathe) in the NPM ecosystem provide a cross-OS-compatible version of the Node APIs. `@shopify/cli-kit` exports modules like system or file that abstract away the usage of those packages, and **thus CLI features must use those modules over the ones provided by Node**. Using `@shopify/cli-kit` modules also eases rolling out fixes, improvements, and optimizations because all features go through the same set of APIs we control.

## Testing

### Automated testing

When implementing business logic that interacts with the OS, for example doing IO operations like creating a Git repository or Zipping a folder, **we strongly recommend writing a unit test that doesn't mock the interactions with the OS**. Those tests will run on Windows, Linux, and macOS on CI and surface any incompatibilities with the OS.


### Manual testing

Please don't assume that a successful working workflow in the OS in which it was developed will yield success in other OSs. **We strongly recommend manually testing the workflow in other OSs**. If you don't have a computer with a given OS, here are some recommendations to virtualize the environment:

#### Linux ([Podman](https://podman.io/))

Run the following command from the CLI directory to create an temporary virtual Linux environment:

```bash
podman run --rm --interactive --tty node:18 /bin/bash
```

Then clone the [CLI repository](https://github.com/Shopify/cli) and install the dependencies with `yarn install`.

#### Windows ([Parallels](https://www.parallels.com/pd/general/))

After you've installed Parallels and virtualized the Windows environment, you need to install the following software:

- [Git](https://git-scm.com/download/win)
- [Node](https://nodejs.org/en/download/)
- [Yarn](https://yarnpkg.com/)
- [Python](https://www.python.org/downloads/windows/) (needed for `node-gyp`)
- [Visual Studio](https://code.visualstudio.com/download) (needed for `node-gyp`, make sure you install the "Desktop development with C++" workload)
- [Ruby](https://rubyinstaller.org/downloads/) (needed for themes, Ruby+DevKit 3.0.4 is recommended)

Git provides a shell called "Git Bash" which you can use. First set your global git user and email:

```bash
git config --global user.email "john.doe@gmail.com"
git config --global user.name "John Doe"
```

Then you can clone the CLI repository:

```bash
git clone https://github.com/Shopify/cli.git
```

Now you can install dependencies with `yarn install`. If Yarn yields "unsigned scripts" errors execute the following command:

```bash
Set-ExecutionPolicy Unrestricted -Scope LocalMachine
```

Now you can run the test suite with `yarn test` and verify that everything works properly.
