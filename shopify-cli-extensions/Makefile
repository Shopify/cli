# https://stackoverflow.com/questions/2214575/passing-arguments-to-make-run
ifeq (run,$(firstword $(MAKECMDGOALS)))
  RUN_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  $(eval $(RUN_ARGS):;@:)
endif

ifeq ($(GOOS),windows)
	executable := shopify-extensions.exe
else
	executable := shopify-extensions
endif

.PHONY: build
build:
	@echo Building executable
	go build -o ${executable}

.PHONY: package
package: build
ifeq ($(GOOS),)
	@echo Requires GOOS to be set >&2
	exit 1
endif

ifeq ($(GOARCH),)
	@echo Requires GOARCH to be set >&2
	exit 1
endif

	@echo Packaging executable
	tar czf shopify-extensions-$(GOOS)-$(GOARCH).tar.gz ${executable}

.PHONY: test
test:
	go test ./...

.PHONY: run
run:
	go run . $(RUN_ARGS)

.PHONY: build-node-package
build-node-package:
	cd packages/shopify-cli-extensions; yarn install; yarn build

.PHONY: bootstrap
bootstrap:
	mkdir -p tmp
	make build
	make build-node-package
	cd packages/shopify-cli-extensions; npm link --force
	./shopify-extensions create < testdata/shopifile.yml
	cd tmp/checkout_ui_extension; npm link "@shopify/shopify-cli-extensions" && npm install
	cd tmp/checkout_ui_extension; cat shopifile.yml | \
		ruby -ryaml -e "puts({'extensions' => [{'development' => YAML.load(STDIN.read).merge({'root_dir' => '.'}), 'type' => 'checkout_ui_extension'}]}.to_yaml)" | \
		../../shopify-extensions build
	test -f tmp/checkout_ui_extension/build/main.js

.PHONY: integration-test
integration-test:
	mkdir -p tmp
	make build
	make build-node-package
	cd packages/shopify-cli-extensions; npm link --force
	./shopify-extensions create < testdata/shopifile.integration.yml
	cd tmp/integration_test; npm link "@shopify/shopify-cli-extensions" && npm install
	cd tmp/integration_test; cat shopifile.yml | \
		ruby -ryaml -e "puts({'extensions' => [{'development' => YAML.load(STDIN.read).merge({'root_dir' => '.'}), 'type' => 'integration_test'}]}.to_yaml)" | \
		../../shopify-extensions build
	test -f tmp/integration_test/build/main.js

