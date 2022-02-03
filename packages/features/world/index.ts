import {setWorldConstructor} from '@cucumber/cucumber';

export interface WorldConstructorParams {
  temporaryDirectory: string;
  cliExecutable: string;
  createAppExecutable: string;
}

export class World {
  public temporaryDirectory: string;
  public cliExecutable: string;
  public createAppExecutable: string;

  constructor({
    temporaryDirectory,
    cliExecutable,
    createAppExecutable,
  }: WorldConstructorParams) {
    this.temporaryDirectory = temporaryDirectory;
    this.cliExecutable = cliExecutable;
    this.createAppExecutable = createAppExecutable;
  }
}

setWorldConstructor(World);
