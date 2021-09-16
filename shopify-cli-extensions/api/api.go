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
	api.connections.Range(func(_, clientHandlers interface{}) bool {
		clientHandlers.(client).notify(statusUpdate)
		return true
	})
}

func (api *ExtensionsApi) Shutdown() {
	api.connections.Range(func(_, clientHandlers interface{}) bool {
		clientHandlers.(client).close(1000, "server shut down")
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

	connection, err := upgrader.Upgrade(rw, r, nil)
	if err != nil {
		return
	}

	notifications := make(chan StatusUpdate)

	closeConnection := func(closeCode int, message string) error {
		close(notifications)
		api.unregisterClient(connection, closeCode, message)
		return nil
	}

	connection.SetCloseHandler(closeConnection)

	api.registerClient(connection, func(update StatusUpdate) {
		notifications <- update
	}, closeConnection)

	err = api.writeJSONMessage(connection, &StatusUpdate{Type: "connected", Extensions: api.Extensions})

	if err != nil {
		closeConnection(websocket.CloseNoStatusReceived, "cannot establish connection to client")
		return
	}

	go handleClientMessages(connection)

	for notification := range notifications {
		encoder := json.NewEncoder(rw)
		encoder.Encode(extensionsResponse{api.Extensions, api.Version})

		err = api.writeJSONMessage(connection, &notification)
		if err != nil {
			break
		}
	}
}

func (api *ExtensionsApi) listExtensions(rw http.ResponseWriter, r *http.Request) {
	rw.Header().Add("Content-Type", "application/json")
	encoder := json.NewEncoder(rw)
	encoder.Encode(extensionsResponse{api.Extensions, api.Version})
}

func (api *ExtensionsApi) registerClient(connection *websocket.Conn, notify notificationHandler, close closeHandler) bool {
	api.connections.Store(connection, client{notify, close})
	return true
}

func (api *ExtensionsApi) unregisterClient(connection *websocket.Conn, closeCode int, message string) {
	duration := 1 * time.Second
	deadline := time.Now().Add(duration)

	connection.SetWriteDeadline(deadline)
	connection.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(closeCode, message))

	// TODO: Break out of this 1 second wait if the client responds correctly to the close message
	<-time.After(duration)
	connection.Close()
	api.connections.Delete(connection)
}

func (api *ExtensionsApi) writeJSONMessage(connection *websocket.Conn, statusUpdate *StatusUpdate) error {
	connection.SetWriteDeadline(time.Now().Add(1 * time.Second))
	return connection.WriteJSON(statusUpdate)
}

func handleClientMessages(connection *websocket.Conn) {
	// TODO: Handle messages from the client
	// Currently we don't do anything with the messages
	// but the code is needed to establish a two-way connection
	for {
		_, _, err := connection.ReadMessage()
		if err != nil {
			break
		}
	}
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

type client struct {
	notify notificationHandler
	close  closeHandler
}

type notificationHandler func(StatusUpdate)

type closeHandler func(code int, text string) error
