// The API package implements an HTTP interface that is responsible for
// - serving build artifacts
// - sending build status updates via websocket
// - provide metadata in form of a manifest to the UI Extension host on the client
//
package api

import (
	"encoding/json"
	"net/http"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/gorilla/mux"
)

type api struct {
	*core.ExtensionService
	*mux.Router
}

func NewApi(service *core.ExtensionService) *api {
	api := &api{service, mux.NewRouter()}

	api.HandleFunc("/", api.extensionsHandler)
	api.PathPrefix("/assets/").Handler(
		http.StripPrefix(
			"/assets/",
			http.FileServer(http.Dir(service.Extensions[0].Development.BuildDir)),
		),
	)

	return api
}

func (api *api) extensionsHandler(rw http.ResponseWriter, r *http.Request) {
	rw.Header().Add("Content-Type", "application/json")
	encoder := json.NewEncoder(rw)
	encoder.Encode(extensionsResponse{api.Extensions, api.Version})
}

type extensionsResponse struct {
	Extensions []core.Extension `json:"extensions"`
	Version    string           `json:"version"`
}
