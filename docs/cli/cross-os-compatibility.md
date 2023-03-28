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

#### Linux ([Parallels](https://www.parallels.com/pd/general/))

Create a new Ubuntu 22 virtual machine, then:

- `sudo apt-get update && sudo apt-get -y upgrade`
- `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -`
- `sudo apt-get install -y git nodejs ruby`
- `curl -fsSL https://get.pnpm.io/install.sh | sh -`

You can clone the CLI repository:

```bash
git clone https://github.com/Shopify/cli.git
```

Install all dependencies:

```bash
pnpm install
```

Now you can test creating an app and installing in your dev store:

```bash
node bin/create-test-app.js -e ui
```

#### Windows ([Parallels](https://www.parallels.com/pd/general/))

After you've installed Parallels and virtualized the Windows environment, you need to install the following software:

- [Git](https://git-scm.com/download/win)
- [Node](https://nodejs.org/en/download/)
- [PNPM](https://pnpm.io/installation)
- [Ruby](https://rubyinstaller.org/downloads/) (needed for themes, Ruby+DevKit 3.0.x is recommended)

We also recommend you install these programs for a better DX:
- [Powershell](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows)
- [VS Code](https://code.visualstudio.com/download)

Please use **Windows Terminal** as your console. You can clone the CLI repository:

```bash
git clone https://github.com/Shopify/cli.git
```

Install all dependencies:

```bash
pnpm install
```

Now you can test creating an app and installing in your dev store:

```bash
node bin/create-test-app.js -e ui
```
