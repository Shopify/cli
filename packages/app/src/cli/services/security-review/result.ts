import {renderSecurityReview} from '../security-review-output.js'
import type {ReviewedAppSecurityResults} from '../security-review.js'

/** Presents reviewed results in the terminal, then sets exit code 1 when they breach `--blocking`. */
export function renderSecurityReviewResult(review: ReviewedAppSecurityResults, options: {verbose: boolean}): void {
  renderSecurityReview({result: review.result, verbose: options.verbose, now: new Date(), commands: review.commands})

  if (review.result.blocking.blockedChecks > 0) process.exitCode = 1
}
