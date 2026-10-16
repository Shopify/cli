import {isAutocorrectEnabled} from '../conf.js'
import type {AutocorrectResult} from './types.js'

export function getAutocorrectStatus(): AutocorrectResult {
  return {enabled: isAutocorrectEnabled()}
}
