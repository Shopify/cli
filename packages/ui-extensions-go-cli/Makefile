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

.PHONY: build-debug
build-debug:
	go build -gcflags=all="-N -l" -o ${executable}

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

.PHONY: bootstrap
bootstrap: tmp build
	./shopify-extensions create testdata/extension.config.yml

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
