/**
 * Error grouping module for generating consistent grouping keys for errors.
 * This module provides utilities to sanitize sensitive data and generate
 * stable keys for error grouping in Observe.
 */

// Main functions
export {generateGroupingKey} from './error-grouping/key-generator.js'
export {extractErrorContext} from './error-grouping/context-extractor.js'
export {sanitizeErrorMessage, sanitizeStackTrace} from './error-grouping/sanitizers.js'

// Patterns and rules
export {SANITIZATION_RULES, getRulesByCategory} from './error-grouping/patterns.js'

// Types
export type {ErrorContext, SanitizationRule} from './error-grouping/types.js'
