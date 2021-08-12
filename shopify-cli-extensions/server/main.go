package main

import (
	"net/http"
	"os"

	"github.com/Shopify/shopify-cli-extensions/server/api"
)

func main() {
	api := api.NewApi(api.NewManifest(os.Args[1]))

	mux := http.NewServeMux()
	mux.Handle("/extensions/", http.StripPrefix("/extensions", api))

	http.ListenAndServe(":8001", mux)
}
