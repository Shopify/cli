// The API package implements an HTTP interface that is responsible for
// - serving build artifacts
// - sending build status updates via websocket
// - provide metadata in form of a manifest to the UI Extension host on the client
//
package api

import (
	"encoding/json"
	"net/http"
)

type api struct {
	manifest *Manifest
	*http.ServeMux
}

func NewApi(manifest *Manifest) *api {
	mux := http.NewServeMux()
	api := &api{manifest, mux}

	mux.HandleFunc("/manifest", http.HandlerFunc(api.GenerateManifest))

	return api
}

func (api *api) GenerateManifest(rw http.ResponseWriter, r *http.Request) {
	rw.Header().Add("Content-Type", "application/json")
	encoder := json.NewEncoder(rw)
	encoder.Encode(api.manifest)
}
