import {join} from 'path';

import Debug from 'debug';
import {readJsonSync, writeFileSync} from 'fs-extra';

interface PackageBase {
  name?: string;
  engines?: {node?: string};
}

interface PackageJson extends PackageBase {
  dependencies: {[key: string]: string};
  devDependencies: {[key: string]: string};
}

interface PackageInternal extends PackageBase {
  dependencies?: Map<string, string>;
  devDependencies?: Map<string, string>;
}

export interface DependencyOptions {
  all?: boolean;
  dev?: boolean;
  prod?: boolean;
}

interface InstallOptions {
  dev?: boolean;
  version?: string;
}

export class Package {
  private internal: PackageInternal;
  private log: (message: string) => void;

  constructor(private _root: string = process.cwd()) {
    this.internal = {};
    this.log = Debug('hydrogenCLI:package');
  }

  addDependencies(dependencies: {[key: string]: string}) {
    this.internal = {
      ...this.internal,
      dependencies: new Map([
        ...Object.entries(dependencies),
        ...Array.from(this.internal.dependencies?.entries() ?? []),
      ]),
    };
  }

  set name(val: string) {
    try {
      const pkgJson: PackageJson = readJsonSync(join(val, 'package.json'));

      if (pkgJson) {
        this.syncInternal({...pkgJson, name: val});
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      this.log(error as string);
    }
  }

  set root(val: string) {
    this._root = val;
    try {
      const pkgJson: PackageJson = readJsonSync(join(val, 'package.json'));

      if (pkgJson) {
        this.syncInternal(pkgJson);
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      this.log(error as string);
    }
  }

  write() {
    const {dependencies, devDependencies, ...rest} = this.internal;
    const pkgJson: PackageJson = {
      ...rest,
      dependencies: {},
      devDependencies: {},
    };

    dependencies?.forEach((version, name) => {
      pkgJson.dependencies[name] = version;
    });

    devDependencies?.forEach((version, name) => {
      pkgJson.devDependencies[name] = version;
    });

    writeFileSync(
      join(this._root, 'package.json'),
      JSON.stringify(pkgJson, null, 2),
    );
  }

  install(dependency: string, options: InstallOptions = {}) {
    if (options.dev) {
      this.internal.devDependencies?.set(
        dependency,
        options.version || 'latest',
      );
      return;
    }
    this.internal.dependencies?.set(dependency, options.version || 'latest');
  }

  hasDependency(name: string): string | undefined {
    const dep =
      this.internal.dependencies?.get(name) ||
      this.internal.devDependencies?.get(name);
    return dep;
  }

  async nodeVersion() {
    return this.internal.engines?.node;
  }

  get packageManager() {
    return /yarn/.test(process.env.npm_execpath || '') ? 'yarn' : 'npm';
  }

  private syncInternal(pkgJson: PackageJson) {
    const {dependencies, devDependencies, ...rest} = pkgJson;
    const newDependencies = Object.entries(dependencies ?? {});
    const newDevDependencies = Object.entries(devDependencies ?? {});

    this.internal = rest;
    this.internal.name = pkgJson.name;
    this.internal.engines = pkgJson.engines;
    this.internal.dependencies = new Map(newDependencies);
    this.internal.devDependencies = new Map(newDevDependencies);
  }
}
