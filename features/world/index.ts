import {setWorldConstructor} from '@cucumber/cucumber';

export interface WorldConstructorParams {
  temporaryDirectory: string;
  cliDirectory: string;
  cliExecutable: string;
  createAppDirectory: string;
  createAppExecutable: string;
}

export class World {
  public temporaryDirectory: string;
  public cliDirectory: string;
  public cliExecutable: string;
  public createAppDirectory: string;
  public createAppExecutable: string;

  constructor({
    temporaryDirectory,
    cliDirectory,
    cliExecutable,
    createAppDirectory,
    createAppExecutable,
  }: WorldConstructorParams) {
    this.temporaryDirectory = temporaryDirectory;
    this.cliDirectory = cliDirectory;
    this.cliExecutable = cliExecutable;
    this.createAppDirectory = createAppDirectory;
    this.createAppExecutable = createAppExecutable;
  }
}

setWorldConstructor(World);
