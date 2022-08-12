# https://stackoverflow.com/questions/2214575/passing-arguments-to-make-run
ifeq (run,$(firstword $(MAKECMDGOALS)))
  RUN_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  $(eval $(RUN_ARGS):;@:)
endif

ifeq ($(GOOS),windows)
	executable := shopify-extensions.exe
	canonical_name := shopify-extensions-$(GOOS)-$(GOARCH).exe
else
	executable := shopify-extensions
	canonical_name := shopify-extensions-$(GOOS)-$(GOARCH)
endif

.PHONY: build
build:
	go build -o ${executable}

.PHONY: build-debug
build-debug:
	go build -gcflags=all="-N -l" -o ${executable}-debug

.PHONY: package
package:
ifeq ($(GOOS),)
	@echo Requires GOOS to be set >&2
	exit 1
endif

ifeq ($(GOARCH),)
	@echo Requires GOARCH to be set >&2
	exit 1
endif
	@echo Run code generation
	go generate

	@echo Build executable
	go build -o ${executable}

	@echo Package executable
	md5sum ${executable} > ${canonical_name}.md5
	gzip ${executable} && mv ${executable}.gz ${canonical_name}.gz

.PHONY: js-test
js-test:
	yarn install
	yarn test

.PHONY: go-test
go-test:
	# Create mock app folder to get go test running
	rm -rf api/dev-console
	mkdir api/dev-console
	touch api/dev-console/index.html
	go test ./...

.PHONY: test
test: js-test go-test

ifeq (serve-dev,$(firstword $(MAKECMDGOALS)))
  SHOPIFILE := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  $(eval $(SHOPIFILE):;@:)
endif

.PHONY: serve-dev
serve-dev:
	VITE_WEBSOCKET_HOST="localhost:$(shell ruby -ryaml -e "puts(YAML.load_file('$(SHOPIFILE)')['port'])")" \
		yarn start & make run serve $(SHOPIFILE)

.PHONY: run
run:
	go run . $(RUN_ARGS)

.PHONY: build-node-packages
build-node-packages:
	yarn install
	yarn --cwd ../ui-extensions-cli build
	ln -sf ../../packages/shopify-cli-extensions/cli.js node_modules/.bin/shopify-cli-extensions

.PHONY: bootstrap
bootstrap: tmp build
	./shopify-extensions create testdata/extension.config.yml

.PHONY: integration-test
integration-test: tmp build
	./shopify-extensions create testdata/extension.config.integration.yml
	cd tmp/integration_test; yarn install
	cat tmp/integration_test/shopify.ui.extension.toml | \
		bundle exec ruby support/merge_config.rb | \
		./shopify-extensions build -
	test -f tmp/integration_test/build/main.js
	test -f tmp/integration_test/locales/en.default.json
	for testfile in `find testdata/test -type f -name '*_test.rb'`; do bundle exec ruby "$$testfile"; done

.PHONY: update-version
update-version:
	git tag -l | sort | tail -n 1 | xargs -I {} ruby -i -pe 'sub(/^const version = .*$$/, "const version = \"{}\"")' -- main.go

tmp:
	mkdir tmp

clean:
	( test -d node_modules && yarn run clean ) || true
	( test -d tmp && rm -r tmp/ ) || true

clobber: clean
	find . -type d -name node_modules -prune -exec rm -rf {} \;	# Remove all subdirectories called 'node_modules'
	rm -rf api/dev-console
	rm packages/tsconfig.tsbuildinfo shopify-extensions
	git clean -fd
