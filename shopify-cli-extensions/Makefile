# https://stackoverflow.com/questions/2214575/passing-arguments-to-make-run
ifeq (run,$(firstword $(MAKECMDGOALS)))
  RUN_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  $(eval $(RUN_ARGS):;@:)
endif

.PHONY: build
build:
	go build -o shopify-extensions .

.PHONY: test
test:
	go test ./...

.PHONY: run
run:
	go run . $(RUN_ARGS)

.PHONY: build-node-package
build-node-package:
	cd packages/shopify-cli-extensions; yarn install; yarn build

.PHONY: setup-test-extension
setup-test-extension:
	cd build/testdata/checkout-ui-extension; rm -rf node_modules; rm yarn.lock; yarn install

.PHONY: integration-test
integration-test:
	mkdir -p tmp
	make build
	make build-node-package
	cd packages/shopify-cli-extensions; yarn link
	./shopify-extensions create < testdata/shopifile.yml
	cd tmp/checkout_ui_extension; yarn link "@shopify/shopify-cli-extensions" || true && yarn install
	cd tmp/checkout_ui_extension; cat shopifile.yml | ruby -e "require 'yaml'; puts({'extensions' => [{'development' => YAML.load(STDIN.read).merge({'root_dir' => '.'}), 'type' => 'checkout_ui_extension'}]}.to_yaml)" | ../../shopify-extensions build
	test -f tmp/checkout_ui_extension/build/main.js
