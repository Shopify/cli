---
id: SESSION_LIFECYCLE_AND_REPLAY
version: 1
severity: high
---

# Session Lifecycle And Replay

Find security-sensitive lifecycle gaps where a session, token, signed URL,
capability, or state-changing endpoint remains usable after the app should have
invalidated it, or where a request can be replayed to repeat a privileged action.

Focus on stale sessions after logout or uninstall, role/permission downgrades,
replayable order or redemption endpoints, and cookie-authenticated state changes
whose protection disappears outside the happy path.

## What to look for

1. **Map the lifecycle boundaries.** Identify login, token issuance, refresh,
   logout, uninstall, revocation, account disconnect, role change, and feature
   disablement flows. Find where sessions, refresh tokens, signed links, and
   capability records are created, rotated, and deleted.

2. **Find replayable sensitive actions.** Search for order fulfillment,
   redemption, refund, payout, invitation, export, configuration, and mutation
   endpoints that can be invoked more than once. Check for nonce, idempotency,
   consumed-token, replay-window, or state-transition guards.

3. **Trace stale artifacts after lifecycle changes.** Verify that logout,
   uninstall, token revocation, shop disconnect, or role downgrade invalidates
   every downstream session, refresh token, signed URL, cache entry, webhook
   capability, and background-job credential that could still authorize work.

4. **Check cookie-authenticated state changes.** For server-rendered or
   cookie-backed flows, verify CSRF protection still applies on replayed direct
   URLs, stale links, and downgraded sessions. Session presence alone is not proof
   that the operation is still authorized.

5. **Compare the first successful action with later retries.** A create path may
   be authorized once but later update/delete/redeem/replay paths may skip the
   same checks. Follow the full state machine, not just the initial handler.

## What to report

Report a finding only for a complete lifecycle or replay path where you can show:
- the principal or caller;
- the stale or replayable artifact;
- the missing invalidation, idempotency, or re-authorization boundary;
- the sensitive action that remains reachable; and
- the affected shop, user, customer, or financial authority.

Example:

```json
{
  "file": "app/controllers/redemptions_controller.rb",
  "line": 42,
  "message": "Redeem endpoint accepts the same signed link after the reward was already consumed",
  "evidence": [
    { "file": "app/controllers/redemptions_controller.rb", "line": 42, "quote": "Reward.find(params[:id]).redeem!" },
    { "file": "app/models/reward.rb", "line": 18, "quote": "def redeem!" }
  ],
  "confidence": "high",
  "reasoning": "The signed redemption URL remains valid after the first redemption and no consumed-token or state-transition guard runs before issuing the reward again."
}
```

Do not report:
- safe retries protected by idempotency keys, consumed-token state, or replay windows;
- stateless GET requests that expose no protected data or side effect;
- cleanup code where you cannot show a stale credential or replayed action remains usable;
- theoretical lifecycle concerns with no demonstrated stale session, replay, or sensitive action.
