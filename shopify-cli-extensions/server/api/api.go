// The API package implements an HTTP interface that is responsible for
// - serving build artifacts
// - sending build status updates via websocket
// - provide metadata in form of a manifest to the UI Extension host on the client
//
package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

type api struct {
	manifest *Manifest
	*mux.Router
}

func NewApi(manifest *Manifest) *api {
	mux := mux.NewRouter()
	api := &api{manifest, mux}

	mux.HandleFunc("/manifest", api.GenerateManifest)
	mux.PathPrefix("/assets/").Handler(
		http.StripPrefix(
			"/assets/",
			http.FileServer(http.Dir(manifest.Development.BuildDir)),
		),
	)

	return api
}

func (api *api) GenerateManifest(rw http.ResponseWriter, r *http.Request) {
	rw.Header().Add("Content-Type", "application/json")
	encoder := json.NewEncoder(rw)
	encoder.Encode(api.manifest)
}
