# FAQ

### Why TOML for the configuration files?

Heroku captures it well in their ["Ground Control to Major TOML: Why Buildpacks Use a Most Peculiar Format"](https://blog.heroku.com/why-buildpacks-use-toml) blog post. TOML is a minimal configuration file format that's easy to read because of its simple semantics. It’s also easy for machines to read and write; you can even append to a TOML file without reading it first, which makes it a great data interchange format.
