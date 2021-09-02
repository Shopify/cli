// The API package implements an HTTP interface that is responsible for
// - serving build artifacts
// - sending build status updates via websocket
// - provide metadata in form of a manifest to the UI Extension host on the client
//
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"sync"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/gorilla/mux"
)

func New(config *core.Config, ctx context.Context) *ExtensionsApi {
	mux := mux.NewRouter()

	mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
		http.Redirect(rw, r, "/extensions", http.StatusMovedPermanently)
	})

	api := configureExtensionsApi(config, mux, ctx)

	return api
}

func configureExtensionsApi(config *core.Config, router *mux.Router, ctx context.Context) *ExtensionsApi {
	api := &ExtensionsApi{
		core.NewExtensionService(config.Extensions, config.Port),
		router,
		newNotifier(ctx),
		false,
	}
	api.HandleFunc("/extensions/", api.extensionsHandler)
	for _, extension := range api.Extensions {
		prefix := fmt.Sprintf("/extensions/%s/assets/", extension.UUID)
		buildDir := filepath.Join(".", extension.Development.RootDir, extension.Development.BuildDir)
		api.PathPrefix(prefix).Handler(
			http.StripPrefix(prefix, http.FileServer(http.Dir(buildDir))),
		)
	}

	return api
}

func (api *ExtensionsApi) extensionsHandler(rw http.ResponseWriter, r *http.Request) {
	rw.Header().Add("Content-Type", "application/json")
	encoder := json.NewEncoder(rw)
	encoder.Encode(extensionsResponse{api.Extensions, api.Version})
}

func (api *ExtensionsApi) PrintOutStatus() {
	for update := range api.notifier.updates {
		log.Printf("Received update: , %v\n", update)
	}
}

func (api *ExtensionsApi) Notify(statusUpdate StatusUpdate) error {
	log.Print("***NOTIFY EVENT")
	success := api.notifier.whenOpen(func() {
		api.notifier.updates <- statusUpdate
	})
	if !success {
		return fmt.Errorf("channel has been closed")
	}
	return nil
}

func (notifier *notifier) whenOpen(callback func()) bool {
	notifier.mu.Lock()
	defer notifier.mu.Unlock()
	if notifier.open {
		callback()
		return true
	}
	return false
}

func newNotifier(ctx context.Context) *notifier {
	notifier := notifier{
		updates: make(chan StatusUpdate, 1),
		open:    true,
		mu:      sync.Mutex{},
	}
	go func() {
		<-ctx.Done()
		notifier.mu.Lock()
		notifier.open = false
		close(notifier.updates)
		notifier.mu.Unlock()
	}()

	return &notifier
}

func (api *ExtensionsApi) Start(ctx context.Context) error {
	httpServer := http.Server{Addr: fmt.Sprintf(":%d", api.Port), Handler: api}
	startupFailed := make(chan error)

	go func() {
		startupFailed <- httpServer.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		return httpServer.Shutdown(ctx)
	case err := <-startupFailed:
		return err
	}
}

type notifier struct {
	open    bool
	updates chan StatusUpdate
	mu      sync.Mutex
}

type ExtensionsApi struct {
	*core.ExtensionService
	*mux.Router
	notifier *notifier
	open     bool
}

type StatusUpdate struct {
	Type       string           `json:"type"`
	Extensions []core.Extension `json:"extensions"`
}

type extensionsResponse struct {
	Extensions []core.Extension `json:"extensions"`
	Version    string           `json:"version"`
}
