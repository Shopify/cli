---
id: SQL_INJECTION
version: 1
severity: high
---

# SQL Injection

Find reachable paths where lower-trust input becomes SQL syntax rather than
bound data, allowing a caller to change the intended database operation.
Review app-owned databases and SQL-backed services, not just Shopify API calls.
A raw-query API, string interpolation, or missing validation is a search lead,
not a finding without a complete source-to-execution path.

## What to look for

1. **Identify the actual database stack.** Read dependency versions, connection
   setup, database adapters, ORM configuration, and query wrappers. Locate SQL
   execution in route handlers, controllers, model scopes, reporting/export
   services, background jobs, and repository-defined stored procedures. Follow
   helpers to the driver instead of assuming what a method named `query` does.

2. **Trace attacker influence in both directions.** Start from query sinks and
   from request parameters, form/JSON bodies, headers, search/filter/sort inputs,
   imports, webhook fields, and merchant/customer-editable records or metafields.
   Follow aliases, transformations, shared packages, and queued jobs. A verified
   webhook or authenticated request can still contain lower-trust business data.
   For Shopify API/webhook fields, identify the actual customer/merchant writer
   and field constraints. A documented field contract or app-visible write path
   can establish control without Shopify's implementation source.
   For second-order injection, trace the original write, storage, later read,
   and query construction; safe insertion does not make the stored value safe
   to concatenate into another query.
   For example, follow a buyer's order note through a verified webhook, safe
   app-side persistence, and later report-query interpolation.

3. **Inspect query-building escape hatches.** Examples to investigate include:
   - JavaScript/TypeScript SQL drivers such as `pg`, `mysql2`, and SQLite adapters;
     Prisma `$queryRawUnsafe`/`$executeRawUnsafe`, raw fragments, Knex `raw`,
     Sequelize `query`/`literal`, and Drizzle `sql.raw`.
   - Rails/ActiveRecord interpolated `where`, `order`, `joins`, `find_by_sql`,
     `Arel.sql`, and connection `execute` calls.
   - Python DB-API `execute`/`executemany`, Django `raw`/`RawSQL`, and SQLAlchemy
     textual SQL; PHP PDO/mysqli queries and Laravel raw expressions.
   - Dynamic SQL inside stored procedures or query-builder wrappers, even when
     the outer invocation uses bound parameters.
   Use the repository's actual language and APIs; this list is not exhaustive.

4. **Separate SQL structure from values.** Check interpolated literals, numeric
   expressions, `IN` lists, `LIKE` patterns, identifiers, sort directions,
   `ORDER BY`, limits, and appended clauses. Value placeholders usually cannot
   bind table names, column names, or keywords. Map keywords and structural
   fragments to fixed SQL; use dialect-appropriate identifier quoting only
   for actual identifiers.
   Binding one value does not protect a different interpolated fragment.

5. **Resolve parameterization semantics before deciding.** Distinguish ordinary
   string interpolation from a SQL tagged template that binds substitutions.
   Follow placeholder arguments through the wrapper to the driver. For example,
   `client.query('SELECT id FROM orders WHERE id = $1', [input])` separates SQL
   from data; concatenating `input` into the SQL text before that call does not.
   Normal ORM filters and correctly bound raw queries are not SQL injection.
   A method containing `raw` or `unsafe` in its name is not proof on its own.
   Inspect escaping, type conversion, allowlists, and decoding in their actual
   dialect and position. If a defense is inadequate, explain exactly how input
   can still become syntax; do not assume every custom helper is bypassable.

6. **Establish the reachable effect.** Identify who controls the value, the auth
   needed to reach the query, and how the resulting query can change a predicate,
   read unauthorized rows, or modify data beyond the intended operation. Do not
   assume stacked statements, database-admin privileges, filesystem access, or
   command execution. An error or wildcard match alone is not SQL injection.
   Distinguish the caller's shop permissions from the app's database authority.
   Verify database grants, row-level security, and database-per-shop connections
   before claiming cross-shop access. Report the demonstrated effect even when
   it is confined to one shop.
   A bound query with a missing tenant filter belongs to
   `MISSING_TENANT_ISOLATION` or `REQUEST_DERIVED_SHOP_SCOPE`, not this check.

## What to report

Use the review pack's current finding and execution schemas, including this
check's ID, version, and prompt hash. Each finding must include:

- The controlling principal and entry point, with required access or preconditions.
- File/line evidence for the input, every relevant transformation or persistence
  boundary, query construction, and the reachable SQL execution call.
- The driver/dialect and binding behavior that make the input SQL syntax rather
  than data, including why any apparent defense fails at this position.
- A minimal, non-destructive illustration of the changed query structure and
  the concrete data or operation exposed. Code reasoning is sufficient; do not
  probe live stores, execute destructive SQL, or access real customer data.
- A fix at the construction boundary: bind values, map structural fragments to
  fixed SQL, and safely quote actual identifiers rather than use keyword blacklists.

Do not report constant SQL, correctly bound values, safe identifier mappings,
unreachable examples/tests, or an ordinary authorized database operation.
Shopify GraphQL variables and search syntax are not SQL sinks without evidence
that app code passes their content into SQL. Missing authorization and NoSQL,
GraphQL, or shell injection are different boundaries.

Record the inspected files and review boundary. If driver behavior, a stored
procedure, a wrapper, or an upstream producer is unavailable and prevents a
conclusion, record the check as unresolved with the review pack's structured
reason and actionable guidance. An unreviewed path did not pass.
