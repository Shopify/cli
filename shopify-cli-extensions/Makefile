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