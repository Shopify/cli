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
	"net/url"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

func New(config *core.Config, apiRoot string) *ExtensionsApi {
	mux := mux.NewRouter().StrictSlash(true)

	mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
		http.Redirect(rw, r, apiRoot, http.StatusTemporaryRedirect)
	})

	api := configureExtensionsApi(config, mux, apiRoot)

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

func configureExtensionsApi(config *core.Config, router *mux.Router, apiRoot string) *ExtensionsApi {
	api := &ExtensionsApi{
		core.NewExtensionService(config, apiRoot),
		router,
		sync.Map{},
		apiRoot,
	}

	api.HandleFunc(apiRoot, api.extensionsHandler)

	for _, extension := range api.Extensions {
		assets := path.Join(apiRoot, extension.UUID, "assets")
		buildDir := filepath.Join(".", extension.Development.RootDir, extension.Development.BuildDir)
		api.PathPrefix(assets).Handler(
			http.StripPrefix(assets, http.FileServer(http.Dir(buildDir))),
		)
	}

	api.HandleFunc(path.Join(apiRoot, "{uuid:(?:[a-z]|[0-9]|-)+}"), api.extensionRootHandler)

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

	close := func(closeCode int, message string) error {
		api.unregisterClient(connection, closeCode, message)
		close(notifications)
		return nil
	}

	connection.SetCloseHandler(close)

	api.registerClient(connection, func(update StatusUpdate) {
		notifications <- update
	}, close)

	err = api.writeJSONMessage(connection, &StatusUpdate{Type: "connected", Extensions: api.Extensions})

	if err != nil {
		close(websocket.CloseNoStatusReceived, "cannot establish connection to client")
		return
	}

	go handleClientMessages(connection)

	for notification := range notifications {
		err = api.writeJSONMessage(connection, &notification)
		if err != nil {
			break
		}
	}

}

func (api *ExtensionsApi) getAbsoluteUrl(r *http.Request, path string) string {
	var protocol string
	if isSecureRequest(r) {
		protocol = "https"
	} else {
		protocol = "http"
	}

	apiRoot := fmt.Sprintf("%s://%s%s", protocol, r.Host, api.apiRoot)
	return fmt.Sprintf("%s%s", apiRoot, path)
}

func (api *ExtensionsApi) listExtensions(rw http.ResponseWriter, r *http.Request) {
	rw.Header().Add("Content-Type", "application/json")
	encoder := json.NewEncoder(rw)

	for index := range api.Extensions {
		api.setExtensionUrls(&api.Extensions[index], r)
	}

	encoder.Encode(extensionsResponse{
		api.Extensions,
		api.Version,
	})
}

func (api *ExtensionsApi) extensionRootHandler(rw http.ResponseWriter, r *http.Request) {
	requestUrl, err := url.Parse(r.RequestURI)

	if err != nil {
		rw.Write([]byte(fmt.Sprintf("not found: %v", err)))
		return
	}

	re := regexp.MustCompile(fmt.Sprintf(`^\/?%v(?P<uuid>([a-z]|[0-9]|-)+)\/?`, api.apiRoot))
	matches := re.FindStringSubmatch(requestUrl.Path)
	uuidIndex := re.SubexpIndex("uuid")
	if uuidIndex < 0 || uuidIndex >= len(matches) {
		rw.Write([]byte("not found, extension has an invalid uuid"))
		return
	}

	uuid := matches[uuidIndex]

	for _, extension := range api.Extensions {
		if extension.UUID == uuid {
			api.setExtensionUrls(&extension, r)

			rw.Header().Add("Content-Type", "application/json")
			encoder := json.NewEncoder(rw)
			encoder.Encode(singleExtensionResponse{extension, api.Version})
			return
		}
	}

	rw.Write([]byte(fmt.Sprintf("not found: %v", err)))
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

func (api *ExtensionsApi) setExtensionUrls(extension *core.Extension, r *http.Request) {
	extension.Development.Root.Url = api.getAbsoluteUrl(r, extension.UUID)

	keys := make([]string, 0, len(extension.Development.Entries))
	for key := range extension.Development.Entries {
		keys = append(keys, key)
	}

	for entry := range keys {
		name := keys[entry]
		extension.Assets[name] = core.Asset{
			Url:  fmt.Sprintf("%s/assets/%s.js", extension.Development.Root.Url, name),
			Name: name,
		}
	}
}

func isSecureRequest(r *http.Request) bool {
	// TODO: Find a better way to handle this - looks like there's no easy way to get the request protocol
	return !strings.HasPrefix(r.Host, "localhost")
}

type ExtensionsApi struct {
	*core.ExtensionService
	*mux.Router
	connections sync.Map
	apiRoot     string
}

type StatusUpdate struct {
	Type       string           `json:"type"`
	Extensions []core.Extension `json:"extensions"`
}

type extensionsResponse struct {
	Extensions []core.Extension `json:"extensions"`
	Version    string           `json:"version"`
}

type singleExtensionResponse struct {
	Extension core.Extension `json:"extension"`
	Version   string         `json:"version"`
}

type client struct {
	notify notificationHandler
	close  closeHandler
}

type notificationHandler func(StatusUpdate)

type closeHandler func(code int, text string) error
