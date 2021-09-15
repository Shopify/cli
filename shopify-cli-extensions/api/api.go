// The API package implements an HTTP interface that is responsible for
// - serving build artifacts
// - sending build status updates via websocket
// - provide metadata in form of a manifest to the UI Extension host on the client
//
package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

func New(config *core.Config) *ExtensionsApi {
	mux := mux.NewRouter()

	mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
		http.Redirect(rw, r, "/extensions/", http.StatusTemporaryRedirect)
	})

	api := configureExtensionsApi(config, mux)

	return api
}

func (api *ExtensionsApi) Notify(statusUpdate StatusUpdate) {
	api.connections.Range(func(_, notify interface{}) bool {
		notify.(notificationHandler)(statusUpdate)
		return true
	})
}

func (api *ExtensionsApi) Shutdown() {
	api.connections.Range(func(connection, _ interface{}) bool {
		api.unregisterClient(connection.(*websocket.Conn))
		return true
	})
}

func configureExtensionsApi(config *core.Config, router *mux.Router) *ExtensionsApi {
	api := &ExtensionsApi{
		core.NewExtensionService(config),
		router,
		sync.Map{},
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
		api.sendStatusUpdates(rw, r)
	} else {
		api.listExtensions(rw, r)
	}
}

func (api *ExtensionsApi) sendStatusUpdates(rw http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	ws, err := upgrader.Upgrade(rw, r, nil)
	if err != nil {
		return
	}

	notifications := make(chan StatusUpdate)

	ws.SetCloseHandler(func(code int, text string) error {
		log.Println("close handler")
		close(notifications)
		api.unregisterClient(ws)
		return nil
	})

	api.registerClient(ws, func(update StatusUpdate) {
		notifications <- update
	})

	ws.SetWriteDeadline(time.Now().Add(1 * time.Second))
	ws.WriteJSON(StatusUpdate{Type: "connected", Extensions: api.Extensions})

	go func() {
		defer ws.Close()
		for {
			_, _, err := ws.ReadMessage()
			if err != nil {
				log.Println("client connection closed")
				break
			}
		}
	}()

	for notification := range notifications {
		encoder := json.NewEncoder(rw)
		encoder.Encode(extensionsResponse{api.Extensions, api.Version})

		ws.SetWriteDeadline(time.Now().Add(1 * time.Second))
		err := ws.WriteJSON(&notification)
		log.Println("Writing update message")
		if err != nil {
			break
		}
	}

	log.Println("Socket closed")
}

func (api *ExtensionsApi) listExtensions(rw http.ResponseWriter, r *http.Request) {
	rw.Header().Add("Content-Type", "application/json")
	encoder := json.NewEncoder(rw)
	encoder.Encode(extensionsResponse{api.Extensions, api.Version})
}

func (api *ExtensionsApi) registerClient(connection *websocket.Conn, notify notificationHandler) bool {
	api.connections.Store(connection, notify)
	return true
}

func (api *ExtensionsApi) unregisterClient(connection *websocket.Conn) {
	duration := 1 * time.Second
	deadline := time.Now().Add(duration)
	connection.SetWriteDeadline(deadline)
	connection.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(1000, "server stopped"))

	<-time.After(duration)
	connection.Close()
	api.connections.Delete(connection)
}

type ExtensionsApi struct {
	*core.ExtensionService
	*mux.Router
	connections sync.Map
}

type StatusUpdate struct {
	Type       string           `json:"type"`
	Extensions []core.Extension `json:"extensions"`
}

type extensionsResponse struct {
	Extensions []core.Extension `json:"extensions"`
	Version    string           `json:"version"`
}

type notificationHandler func(StatusUpdate)
