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
	extension *Extension
	*mux.Router
}

func NewApi(extension *Extension) *api {
	mux := mux.NewRouter()
	api := &api{extension, mux}

	mux.HandleFunc("/manifest", api.GenerateManifest)
	mux.PathPrefix("/assets/").Handler(
		http.StripPrefix(
			"/assets/",
			http.FileServer(http.Dir(extension.Development.BuildDir)),
		),
	)

	return api
}

func (api *api) GenerateManifest(rw http.ResponseWriter, r *http.Request) {
	rw.Header().Add("Content-Type", "application/json")
	encoder := json.NewEncoder(rw)
	encoder.Encode(api.extension)
}
