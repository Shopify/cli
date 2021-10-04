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
	"github.com/iancoleman/strcase"
	"github.com/imdario/mergo"
)

func New(config *core.Config, apiRoot string) *ExtensionsApi {
	mux := mux.NewRouter().StrictSlash(true)

	mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
		http.Redirect(rw, r, apiRoot, http.StatusTemporaryRedirect)
	})

	api := configureExtensionsApi(config, mux, apiRoot)

	return api
}

func (api *ExtensionsApi) sendUpdateEvent(extensions []core.Extension) {
	api.connections.Range(func(connection, clientHandlers interface{}) bool {
		rootUrl := connection.(*websocketConnection).rootUrl
		clientHandlers.(client).notify(StatusUpdate{
			Event:      "update",
			Extensions: getExtensionsWithUrl(extensions, rootUrl),
		})
		return true
	})
}

func (api *ExtensionsApi) Shutdown() {
	api.connections.Range(func(_, clientHandlers interface{}) bool {
		clientHandlers.(client).close(1000, "server shut down")
		return true
	})
}

func (api *ExtensionsApi) Notify(extensions []core.Extension) {
	for _, extension := range extensions {
		updateData, found := api.updates.Load(extension.UUID)
		if found {
			if err := mergo.MergeWithOverwrite(&updateData, &extensions); err != nil {
				log.Printf("failed to merge update data %v", err)
			}
		} else {
			api.updates.Store(extension.UUID, extension)
		}
	}

	updatedExtensions := make([]core.Extension, 0)
	for index := range api.Extensions {
		updateData, found := api.updates.LoadAndDelete(api.Extensions[index].UUID)
		if found {
			err := mergo.MergeWithOverwrite(&api.Extensions[index], updateData)
			if err != nil {
				log.Printf("failed to merge update data %v", err)
			}
			updatedExtensions = append(updatedExtensions, api.Extensions[index])
		}
	}
	if len(updatedExtensions) == 0 {
		return
	}

	api.sendUpdateEvent(updatedExtensions)
}

func configureExtensionsApi(config *core.Config, router *mux.Router, apiRoot string) *ExtensionsApi {
	api := &ExtensionsApi{
		core.NewExtensionService(config, apiRoot),
		router,
		sync.Map{},
		apiRoot,
		sync.Map{},
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

	upgradedConnection, err := upgrader.Upgrade(rw, r, nil)
	if err != nil {
		return
	}

	connection := &websocketConnection{upgradedConnection, api.getApiRootFromRequest(r)}
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

	err = api.writeJSONMessage(connection, &StatusUpdate{Event: "connected", Extensions: getExtensionsWithUrl(api.Extensions, connection.rootUrl)})

	if err != nil {
		close(websocket.CloseNoStatusReceived, "cannot establish connection to client")
		return
	}

	go api.handleClientMessages(connection)

	for notification := range notifications {
		err = api.writeJSONMessage(connection, &notification)
		if err != nil {
			log.Printf("error writing JSON message: %v", err)
			break
		}
	}

}

func (api *ExtensionsApi) getApiRootFromRequest(r *http.Request) string {
	var protocol string
	if isSecureRequest(r) {
		protocol = "https"
	} else {
		protocol = "http"
	}

	return fmt.Sprintf("%s://%s%s", protocol, r.Host, api.apiRoot)
}

func getExtensionsWithUrl(extensions []core.Extension, rootUrl string) []core.Extension {
	updatedCopy := []core.Extension{}
	for _, extension := range extensions {
		updatedCopy = append(updatedCopy, setExtensionUrls(extension, rootUrl))
	}
	return updatedCopy
}

func (api *ExtensionsApi) listExtensions(rw http.ResponseWriter, r *http.Request) {
	rw.Header().Add("Content-Type", "application/json")
	encoder := json.NewEncoder(rw)

	encoder.Encode(extensionsResponse{
		&Response{api.App, api.Version},
		getExtensionsWithUrl(api.Extensions, api.getApiRootFromRequest(r)),
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
			extensionWithUrls := setExtensionUrls(extension, api.getApiRootFromRequest(r))
			rw.Header().Add("Content-Type", "application/json")
			encoder := json.NewEncoder(rw)
			encoder.Encode(singleExtensionResponse{&Response{api.App, api.Version}, extensionWithUrls})
			return
		}
	}

	rw.Write([]byte(fmt.Sprintf("not found: %v", err)))
}

func (api *ExtensionsApi) registerClient(connection *websocketConnection, notify notificationHandler, close closeHandler) bool {
	api.connections.Store(connection, client{notify, close})
	return true
}

func (api *ExtensionsApi) unregisterClient(connection *websocketConnection, closeCode int, message string) {
	duration := 1 * time.Second
	deadline := time.Now().Add(duration)

	connection.SetWriteDeadline(deadline)
	connection.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(closeCode, message))

	// TODO: Break out of this 1 second wait if the client responds correctly to the close message
	<-time.After(duration)
	connection.Close()
	api.connections.Delete(connection)
}

func (api *ExtensionsApi) writeJSONMessage(connection *websocketConnection, statusUpdate *StatusUpdate) error {
	connection.SetWriteDeadline(time.Now().Add(1 * time.Second))
	websocketMessage := WebsocketMessage{
		Event: statusUpdate.Event,
		Data: WebsocketData{
			Extensions: statusUpdate.Extensions,
			App:        formatData(api.App, strcase.ToLowerCamel),
		},
		Version: api.Version,
	}

	return connection.WriteJSON(websocketMessage)
}

func (api *ExtensionsApi) handleClientMessages(ws *websocketConnection) {
	for {
		_, message, err := ws.ReadMessage()
		if err != nil {
			break
		}

		jsonMessage := WebsocketMessage{}

		err = json.Unmarshal(message, &jsonMessage)
		if err != nil {
			log.Printf("failed to read client JSON message %v", err)
		}

		switch jsonMessage.Event {
		case "update":
			if jsonMessage.Data.App != nil {
				app := formatData(jsonMessage.Data.App, strcase.ToSnake)
				if app["api_key"] == api.App["api_key"] {
					mergeData(api.App, app)
					go api.sendUpdateEvent([]core.Extension{})
				}
			}
			go api.Notify(jsonMessage.Data.Extensions)

		case "dispatch":

		}
	}
}

func setExtensionUrls(original core.Extension, rootUrl string) core.Extension {
	extension := core.Extension{}
	err := mergo.MergeWithOverwrite(&extension, &original)
	if err != nil {
		return original
	}

	extension.Development.Root.Url = fmt.Sprintf("%s%s", rootUrl, extension.UUID)

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
	return extension
}

func isSecureRequest(r *http.Request) bool {
	// TODO: Find a better way to handle this - looks like there's no easy way to get the request protocol
	re := regexp.MustCompile(`:([0-9])+$`)
	hasPort := re.MatchString(r.Host)
	return !strings.HasPrefix(r.Host, "localhost") && !hasPort

}

func mergeData(source map[string]interface{}, data map[string]interface{}) {
	forEachValueInMap(data, func(key string, value interface{}) {
		source[key] = value
	})
}

func formatData(data map[string]interface{}, formatter func(str string) string) map[string]interface{} {
	formattedData := make(map[string]interface{})
	forEachValueInMap(data, func(key string, value interface{}) {
		formattedData[formatter(key)] = value
	})
	return formattedData
}

func forEachValueInMap(data map[string]interface{}, onEachValue func(key string, value interface{})) {
	keys := make([]string, 0, len(data))
	for key := range data {
		keys = append(keys, key)
	}
	for entry := range keys {
		onEachValue(keys[entry], data[keys[entry]])
	}
}

type ExtensionsApi struct {
	*core.ExtensionService
	*mux.Router
	connections sync.Map
	apiRoot     string
	updates     sync.Map
}

type StatusUpdate struct {
	Event      string           `json:"event"`
	Extensions []core.Extension `json:"extensions"`
}

type WebsocketData struct {
	Extensions []core.Extension `json:"extensions"`
	App        core.App         `json:"app"`
}

type WebsocketMessage struct {
	Event   string        `json:"event"`
	Data    WebsocketData `json:"data"`
	Version string        `json:"version"`
}

type Response struct {
	App     core.App `json:"app" yaml:"-"`
	Version string   `json:"version"`
}

type websocketConnection struct {
	*websocket.Conn
	rootUrl string
}

type extensionsResponse struct {
	*Response
	Extensions []core.Extension `json:"extensions"`
}

type singleExtensionResponse struct {
	*Response
	Extension core.Extension `json:"extension"`
}

type client struct {
	notify notificationHandler
	close  closeHandler
}

type notificationHandler func(StatusUpdate)

type closeHandler func(code int, text string) error
