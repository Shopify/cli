// The API package implements an HTTP interface that is responsible for
// - serving build artifacts
// - sending build status updates via websocket
// - provide metadata in form of a manifest to the UI Extension host on the client
//
package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/gorilla/mux"
)

func New(config *core.Config) http.Handler {
	mux := mux.NewRouter()

	mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
		http.Redirect(rw, r, "/extensions", http.StatusMovedPermanently)
	})
	configureExtensionsApi(config, mux)

	return mux
}

func configureExtensionsApi(config *core.Config, router *mux.Router) *extensionsApi {
	api := &extensionsApi{core.NewExtensionService(config.Extensions), router}

	api.HandleFunc("/extensions/", api.extensionsHandler)
	for _, extension := range api.Extensions {
		prefix := fmt.Sprintf("/extensions/%s/assets/", extension.UUID)
		buildDir := filepath.Join(extension.Development.RootDir, extension.Development.BuildDir)

		api.PathPrefix(prefix).Handler(
			http.StripPrefix(prefix, http.FileServer(http.Dir(buildDir))),
		)
	}

	return api
}

type extensionsApi struct {
	*core.ExtensionService
	*mux.Router
}

func (api *extensionsApi) extensionsHandler(rw http.ResponseWriter, r *http.Request) {
	rw.Header().Add("Content-Type", "application/json")
	encoder := json.NewEncoder(rw)
	encoder.Encode(extensionsResponse{api.Extensions, api.Version})
}

type extensionsResponse struct {
	Extensions []core.Extension `json:"extensions"`
	Version    string           `json:"version"`
}
