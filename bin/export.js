#!/usr/bin/env node

/**
 * This script packs and exports the CLIs into a given directory including their
 * node_modules dependencies. After the export, the CLIs can be executed outside
 * of the context of this repository. This is useful for running e2e tests
 * or bundling the CLI in a portable format like a Deno binary.
 */
import tempy from 'tempy';
import pathe from "pathe";
import path from "path/posix";
import { fileURLToPath } from 'url';
import fs from "fs";

import execa from "execa";

const cliPackages = await ["cli", "create-app", "create-hydrogen", "hydrogen", "app", "cli-kit"]
const rootDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function cliDependencies() {
    const packageJsonPaths = cliPackages.map((packageName) => path.join(rootDirectory, "packages", packageName, "package.json"))
    const packageJsons = await Promise.all(packageJsonPaths.map(async (packageJsonPath) => {
        const packageJson = await fs.promises.readFile(packageJsonPath, 'utf-8')
        return JSON.parse(packageJson)
    }))
    const dependenciesEntries = packageJsons.flatMap((packageJson) => Object.entries(packageJson.dependencies ?? {}))
    const dependencies = Object.fromEntries(dependenciesEntries);
    delete dependencies["@shopify/cli-kit"]
    delete dependencies["@shopify/app"]
    delete dependencies["@shopify/hydrogen"]
    return dependencies;
}

async function pack(outputDirectory) {
    let cliExecutablePath;
    let createAppExecutablePath;

    await tempy.directory.task(async (temporaryDirectory) => {
        const clisDirectory = path.join(outputDirectory, "shopify");
        if (fs.existsSync(clisDirectory)) {
            throw new Error(`The directory ${clisDirectory} already exists`)
        }

        // Pack packages
        console.log("📦 Packing @shopify/cli-kit...")
        const cliKitPackPath = path.join(temporaryDirectory, "cli-kit.tar.gz");
        await execa("yarn", ["pack", "--filename", cliKitPackPath], {cwd: path.join(rootDirectory, "packages/cli-kit") })

        console.log("📦 Packing @shopify/app...")
        const appPackPath = path.join(temporaryDirectory, "app.tar.gz");
        await execa("yarn", ["pack", "--filename", appPackPath], {cwd: path.join(rootDirectory, "packages/app") })

        console.log("📦 Packing @shopify/cli...")
        const cliPackPath = path.join(temporaryDirectory, "cli.tar.gz");
        await execa("yarn", ["pack", "--filename", cliPackPath], {cwd: path.join(rootDirectory, "packages/cli") })

        console.log("📦 Packing @shopify/create-app...")
        const createAppPackPath = path.join(temporaryDirectory, "create-app.tar.gz");
        await execa("yarn", ["pack", "--filename", createAppPackPath], {cwd: path.join(rootDirectory, "packages/create-app") })

        console.log("📦 Packing @shopify/create-hydrogen...")
        const createHydrogenPackPath = path.join(temporaryDirectory, "create-hydrogen.tar.gz");
        await execa("yarn", ["pack", "--filename", createHydrogenPackPath], {cwd: path.join(rootDirectory, "packages/create-hydrogen") })

        // Output in ./clis
        const clisPackageJsonPath = path.join(clisDirectory, "package.json");
        const clisNodeModulesPath = path.join(clisDirectory, 'node_modules');
        await fs.promises.mkdir(clisDirectory, {recursive: true})
        const packageJson = {
            type: "module",
            private: true,
            name: "@shopify/clis",
            dependencies: await cliDependencies()
        }
        await fs.promises.writeFile(clisPackageJsonPath, JSON.stringify(packageJson), 'utf-8')
        console.log("⬇️  Installing dependencies...")
        await execa("yarn", ["install"], {cwd: clisDirectory })

        const unpackPath = path.join(temporaryDirectory, "unpack");
        await fs.promises.mkdir(unpackPath, {recursive: true})

        console.log("📦 Unpacking @shopify/cli-kit under node_modules/@shopify/cli-kit")
        const clisNodeModulesShopifyCLIKitPath = path.join(clisNodeModulesPath, "@shopify/cli-kit");
        await fs.promises.mkdir(path.dirname(clisNodeModulesShopifyCLIKitPath), {recursive: true})
        await execa("tar", ["-zx", "-f", cliKitPackPath], {cwd: unpackPath})
        await fs.promises.rename(path.join(unpackPath, "package"), clisNodeModulesShopifyCLIKitPath)

        console.log("📦 Unpacking @shopify/app under node_modules/@shopify/app")
        const clisNodeModulesShopifyAppPath = path.join(clisNodeModulesPath, "@shopify/app");
        await fs.promises.mkdir(path.dirname(clisNodeModulesShopifyAppPath), {recursive: true})
        await execa("tar", ["-zx", "-f", appPackPath], {cwd: unpackPath})
        await fs.promises.rename(path.join(unpackPath, "package"), clisNodeModulesShopifyAppPath)

        console.log("📦 Unpacking @shopify/cli under cli")
        const cliPath = path.join(clisDirectory, "cli");
        await fs.promises.mkdir(path.dirname(cliPath), {recursive: true})
        await execa("tar", ["-zx", "-f", cliPackPath], {cwd: unpackPath})
        await fs.promises.rename(path.join(unpackPath, "package"), cliPath)

        console.log("📦 Unpacking @shopify/create-app under cli")
        const createAppPath = path.join(clisDirectory, "create-app");
        await fs.promises.mkdir(path.dirname(createAppPath), {recursive: true})
        await execa("tar", ["-zx", "-f", createAppPackPath], {cwd: unpackPath})
        await fs.promises.rename(path.join(unpackPath, "package"), createAppPath)

        console.log("📦 Unpacking @shopify/create-hydrogen under cli")
        const createHydrogenPath = path.join(clisDirectory, "create-hydrogen");
        await fs.promises.mkdir(path.dirname(createHydrogenPath), {recursive: true})
        await execa("tar", ["-zx", "-f", createHydrogenPackPath], {cwd: unpackPath})
        await fs.promises.rename(path.join(unpackPath, "package"), createHydrogenPath)

        cliExecutablePath = path.join(cliPath, "bin/run.js")
        createAppExecutablePath = path.join(createAppPath, "bin/run.js")
    })

    return {cliExecutablePath, createAppExecutablePath}
}

export default pack;

const runningAsScript = import.meta.url.endsWith(path.basename(process.argv[1]));
if (runningAsScript) {
    if (process.argv.length !== 3) {
        console.log("The output directory is missing: pack.js ~/output")
    }
    pack(process.argv[2])
}


