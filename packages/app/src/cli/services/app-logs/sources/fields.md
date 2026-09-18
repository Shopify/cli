# App log sources JSON field inventory

`linkedAppContext` has already loaded the local extension models. No additional API requests are needed.

Each source includes the filter string (`source`), namespace, extension handle, name, type, external type, human-readable type name, UID,
directory, configuration path, complete public configuration, entry source path, output path, surface, capabilities
(`features`) and optional dependency. The configuration retains type-specific fields such as API version, targets,
input queries and build settings; JSON is not restricted to the source names shown in text output.

Only function extensions are valid log sources. App and organization metadata describe the parent app, not a source,
and belong to `app info`. Development-session UUIDs, environment-variable aliases, schema objects, callbacks,
build/watch implementation details and caches are internal data. Specification identity and capabilities are exposed
through the explicit fields above rather than serializing the runtime specification object.

There was no supported JSON collection before this PR. The new result is an array of records; text keeps its existing
namespace sections and source strings. `source` retains exactly the value accepted by `app logs --source`.
