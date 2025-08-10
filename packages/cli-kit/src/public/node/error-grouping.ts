/**
 * Error grouping module for generating consistent grouping hashes for errors.
 * This module provides utilities to sanitize sensitive data and generate
 * stable hashes for error grouping in Bugsnag/Observe.
 */

// Main functions
export {generateGroupingHash, clearHashCache} from './error-grouping/hash-generator.js'
export {extractErrorContext} from './error-grouping/context-extractor.js'
export {sanitizeErrorMessage, sanitizeStackTrace} from './error-grouping/sanitizers.js'

// Patterns and rules
export {SANITIZATION_RULES, getRulesByCategory} from './error-grouping/patterns.js'

// Types
export type {ErrorContext, SanitizationRule, GroupingHashOptions, HashGenerationResult} from './error-grouping/types.js'
