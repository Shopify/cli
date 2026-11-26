import {isAutocorrectEnabled, setAutocorrect} from '../conf.js'
import type {AutocorrectResult} from './types.js'

export function getAutocorrectStatus(): AutocorrectResult {
  return {enabled: isAutocorrectEnabled()}
}

export function configureAutocorrect(enabled: boolean): AutocorrectResult {
  setAutocorrect(enabled)
  return {enabled}
}
