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
	"net/http"
	"path/filepath"
	"sync"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

func New(config *core.Config, ctx context.Context) *ExtensionsApi {
	mux := mux.NewRouter()

	mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
		http.Redirect(rw, r, "/extensions", http.StatusMovedPermanently)
	})

	api := configureExtensionsApi(config, mux, ctx)

	return api
}

func (api *ExtensionsApi) Start(ctx context.Context) error {
	httpServer := http.Server{Addr: fmt.Sprintf(":%d", api.Port), Handler: api}
	startupFailed := make(chan error)

	go func() {
		startupFailed <- httpServer.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		api.shutdown()
		return httpServer.Shutdown(ctx)
	case err := <-startupFailed:
		return err
	}
}

func (api *ExtensionsApi) Notify(statusUpdate StatusUpdate) {
	for _, notify := range api.connections {
		notify(statusUpdate)
	}
}

func configureExtensionsApi(config *core.Config, router *mux.Router, ctx context.Context) *ExtensionsApi {
	api := &ExtensionsApi{
		core.NewExtensionService(config.Extensions, config.Port),
		router,
		make(map[*websocket.Conn]func(status StatusUpdate)),
		sync.Mutex{},
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
	if websocket.IsWebSocketUpgrade(r) {
		api.extensionsWebsocketHandler(rw, r)
	} else {
		api.extensionsJSONHandler(rw, r)
	}
}

func (api *ExtensionsApi) extensionsWebsocketHandler(rw http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	websocket, err := upgrader.Upgrade(rw, r, nil)
	if err != nil {
		return
	}

	notifications := make(chan StatusUpdate)

	notify := func(notification StatusUpdate) {
		notifications <- notification
	}

	go func() {
		for notification := range notifications {
			encoder := json.NewEncoder(rw)
			encoder.Encode(extensionsResponse{api.Extensions, api.Version})
			websocket.WriteJSON(&notification)
		}
	}()

	api.registerClient(websocket, notify)

	websocket.SetCloseHandler(func(code int, text string) error {
		close(notifications)
		api.unregisterClient(websocket)
		return nil
	})

	websocket.WriteJSON(StatusUpdate{Type: "connected", Extensions: api.Extensions})
}

func (api *ExtensionsApi) extensionsJSONHandler(rw http.ResponseWriter, r *http.Request) {
	rw.Header().Add("Content-Type", "application/json")
	encoder := json.NewEncoder(rw)
	encoder.Encode(extensionsResponse{api.Extensions, api.Version})
}

func (api *ExtensionsApi) registerClient(connection *websocket.Conn, notify func(update StatusUpdate)) bool {
	api.mu.Lock()
	defer api.mu.Unlock()
	api.connections[connection] = notify
	return true
}

func (api *ExtensionsApi) unregisterClient(connection *websocket.Conn) {
	api.mu.Lock()
	defer api.mu.Unlock()
	if api.connections == nil {
		return
	}
	connection.Close()
	delete(api.connections, connection)
}

func (api *ExtensionsApi) shutdown() {
	for connection := range api.connections {
		api.unregisterClient(connection)
	}
}

type ExtensionsApi struct {
	*core.ExtensionService
	*mux.Router
	connections map[*websocket.Conn]func(status StatusUpdate)
	mu          sync.Mutex
}

type StatusUpdate struct {
	Type       string           `json:"type"`
	Extensions []core.Extension `json:"extensions"`
}

type extensionsResponse struct {
	Extensions []core.Extension `json:"extensions"`
	Version    string           `json:"version"`
}
