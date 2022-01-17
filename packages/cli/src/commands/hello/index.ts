import {Command} from '@oclif/core';

export default class Hello extends Command {
  static description = 'Say hello';

  async run(): Promise<void> {
    throw new Error('command error');
  }
}
