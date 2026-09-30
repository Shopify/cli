# Legacy `marketing_activity_extension`

`marketing_activity_extension` is an older identifier for the [marketing activity schema](marketing-activity-legacy.md).

```text
LegacyMarketingActivityExtension := MarketingActivity
```

This identifier predates the final `type = "marketing_activity"` template. The sources contain no distinct field schema, so only the type literal changes. Its `up` migration should preserve every field, change the type to `marketing_activity`, then run any platform-backed app-module migration.

Keep a separate E2E fixture because the CLI dispatches on type before validating fields.
