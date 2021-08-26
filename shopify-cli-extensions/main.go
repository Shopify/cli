package main

import (
	"net/http"
	"os"

	"github.com/Shopify/shopify-cli-extensions/api"
	"github.com/Shopify/shopify-cli-extensions/core"
)

func main() {
	cmd, args := os.Args[1], os.Args[2:]

	// temp value that would be replaced by actual config
	config := make(map[string]string)
	cli := newCli(config)

	switch cmd {
	case "build":
		cli.build(args...)
	case "create":
		cli.create(args...)
	case "serve":
		cli.serve(args...)
	}
}

type CLI struct {
	config map[string]string
}

func newCli(config map[string]string) *CLI {
	return &CLI{config: config}
}

func (cli *CLI) build(args ...string) {
	panic("not implemented")
}

func (cli *CLI) create(args ...string) {
	panic("not implemented")
}

func (cli *CLI) serve(args ...string) {
	if len(args) != 1 {
		panic("serve requires a path to be specified")
	}

	api := api.NewApi(core.NewExtensionService(args[0]))

	mux := http.NewServeMux()
	mux.Handle("/extensions/", http.StripPrefix("/extensions", api))

	http.ListenAndServe(":8000", mux)
}
