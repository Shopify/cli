package main

import (
	"net/http"
	"os"

	"github.com/Shopify/shopify-cli-extensions/api"
	"github.com/Shopify/shopify-cli-extensions/core"
)

func main() {
	cmd, args := os.Args[1], os.Args[2:]
	switch cmd {
	case "build":
		build(args...)
	case "create":
		create(args...)
	case "serve":
		serve(args...)
	}
}

func build(args ...string) {
	panic("not implemented")
}

func create(args ...string) {
	panic("not implemented")
}

func serve(args ...string) {
	if len(args) != 1 {
		panic("serve requires a path to be specified")
	}

	api := api.NewApi(core.NewExtensionService(args[0]))

	mux := http.NewServeMux()
	mux.Handle("/extensions/", http.StripPrefix("/extensions", api))

	http.ListenAndServe(":8000", mux)
}
