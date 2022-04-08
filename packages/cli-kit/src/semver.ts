import {Abort} from './error'
import Semver from 'semver/classes/semver'

export class Version extends Semver {
  constructor(version: string) {
    try {
      super(version)
    } catch (error: any) {
      throw new Abort(error.message)
    }
  }
}
