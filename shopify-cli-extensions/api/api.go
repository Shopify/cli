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

	"github.com/Shopify/shopify-cli-extensions/api/root"
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
	api.notifyClients(func(rootUrl string) (message notification, err error) {
		return api.getNotification("update", extensions, rootUrl)
	})
}

func (api *ExtensionsApi) notifyClients(createNotification func(rootUrl string) (message notification, err error)) {
	api.connections.Range(func(connection, clientHandlers interface{}) bool {
		notification, err := createNotification(connection.(*websocketConnection).rootUrl)
		if err != nil {
			log.Printf("failed to construct notification with error: %v", err)
			return false
		}
		clientHandlers.(client).notify(notification)
		return true
	})
}

func (api *ExtensionsApi) getNotification(event string, extensions []core.Extension, rootUrl string) (message notification, err error) {
	extensionsWithUrls := getExtensionsWithUrl(extensions, rootUrl)
	app := formatData(api.App, strcase.ToLowerCamel)

	data, err := api.getNotificationData(extensionsWithUrls, app)
	if err != nil {
		return
	}
	message = notification{Event: event, Data: data}
	return
}

func (api *ExtensionsApi) getNotificationData(extensions interface{}, app interface{}) (data map[string]interface{}, err error) {
	data = make(map[string]interface{})
	extensionData, err := getJSONRawMessage(extensions)
	if err != nil {
		return
	}
	appData, err := getJSONRawMessage(app)
	if err != nil {
		return
	}

	data["extensions"] = extensionData
	data["app"] = appData
	return
}

// Returns a notification that combines arbitrary data
// with the API's own data for app and extensions
func (api *ExtensionsApi) getDispatchNotification(rawData json.RawMessage, rootUrl string) (message notification, err error) {
	dispatchData := make(map[string]interface{})
	if err = json.Unmarshal(rawData, &dispatchData); err != nil {
		return
	}

	data := websocketData{}
	if err = json.Unmarshal(rawData, &data); err != nil {
		return
	}

	mergedApp, _ := api.getMergedAppMap(data.App, false)
	extensions := api.getMergedExtensionsMap(data.Extensions, rootUrl)

	appAndExtensions, err := api.getNotificationData(extensions, mergedApp)

	if err != nil {
		return
	}

	err = mergo.MapWithOverwrite(&dispatchData, &appAndExtensions)
	if err != nil {
		return
	}

	message = notification{Event: "dispatch", Data: dispatchData}
	return
}

func getJSONRawMessage(data interface{}) (result json.RawMessage, err error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return
	}
	result = json.RawMessage(jsonData)
	return
}

func interfaceToMap(data interface{}) (result map[string]interface{}, err error) {
	converted, err := json.Marshal(data)
	if err != nil {
		log.Printf("error converting to JSON %v", err)
		return
	}
	if err = json.Unmarshal(converted, &result); err != nil {
		log.Printf("error converting to map %v", err)
		return
	}
	return
}

func (api *ExtensionsApi) getMergedAppMap(additionalInfo map[string]interface{}, overwrite bool) (app map[string]interface{}, updated bool) {
	app = formatData(api.App, strcase.ToLowerCamel)
	if additionalInfo["apiKey"] == app["apiKey"] {
		if err := mergo.MapWithOverwrite(&app, additionalInfo); err != nil {
			log.Printf("error merging app info, %v", err)
			return
		}

		if overwrite {
			if err := mergo.MapWithOverwrite(&api.App, formatData(app, strcase.ToSnake)); err != nil {
				log.Printf("error merging app info, %v", err)
				return
			}
		}
		updated = true
	}
	return
}

func (api *ExtensionsApi) getMergedExtensionsMap(extensions []map[string]interface{}, rootUrl string) []map[string]interface{} {
	targetExtensions := make(map[string]map[string]interface{})
	for _, extension := range extensions {
		targetExtensions[fmt.Sprintf("%v", extension["uuid"])] = extension
	}

	results := make([]map[string]interface{}, 0)
	for _, extension := range api.Extensions {
		if target, found := targetExtensions[extension.UUID]; found {
			extensionWithUrls := setExtensionUrls(extension, rootUrl)
			extensionData, err := interfaceToMap(extensionWithUrls)
			if err != nil {
				continue
			}
			err = mergo.MapWithOverwrite(&extensionData, &target)
			if err != nil {
				log.Printf("failed to merge update data %v", err)
				continue
			}
			results = append(results, extensionData)
		}
	}
	return results
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
			castedData := updateData.(core.Extension)
			if err := mergeWithOverwrite(&castedData, &extensions); err != nil {
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
			castedData := updateData.(core.Extension)

			if castedData.Development.Status == "success" {
				for entry := range api.Extensions[index].Assets {
					api.Extensions[index].Assets[entry] = core.Asset{
						Name:            api.Extensions[index].Assets[entry].Name,
						RawSearchParams: fmt.Sprintf("?timestamp=%d", time.Now().Unix()),
					}
				}
			}
			err := mergeWithOverwrite(&api.Extensions[index], &castedData)
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
		root.New(config, apiRoot),
		sync.Map{},
		apiRoot,
		sync.Map{},
	}

	api.HandleFunc(apiRoot, handlerWithCors(api.extensionsHandler))

	for _, extension := range api.Extensions {
		assets := path.Join(apiRoot, extension.UUID, "assets")
		buildDir := filepath.Join(".", extension.Development.RootDir, extension.Development.BuildDir)
		api.PathPrefix(assets).Handler(
			withCors(http.StripPrefix(assets, http.FileServer(http.Dir(buildDir)))),
		)
	}

	api.HandleFunc(path.Join(apiRoot, "{uuid:(?:[a-z]|[0-9]|-)+}"), handlerWithCors(api.extensionRootHandler))

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

	connection := &websocketConnection{upgradedConnection, api.GetApiRootUrlFromRequest(r)}
	notifications := make(chan notification)

	close := func(closeCode int, message string) error {
		api.unregisterClient(connection, closeCode, message)
		close(notifications)
		return nil
	}

	connection.SetCloseHandler(close)

	api.registerClient(connection, func(update notification) {
		notifications <- update
	}, close)

	notification, err := api.getNotification("connected", api.Extensions, connection.rootUrl)
	if err != nil {
		close(websocket.CloseNoStatusReceived, fmt.Sprintf("cannot send connected message, failed with error: %v", err))
	}
	err = api.writeJSONMessage(connection, &notification)
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
		getExtensionsWithUrl(api.Extensions, api.GetApiRootUrlFromRequest(r)),
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
			extensionWithUrls := setExtensionUrls(extension, api.GetApiRootUrlFromRequest(r))

			if strings.HasPrefix(r.Header.Get("accept"), "text/html") {
				api.HandleHTMLRequest(rw, r, &extensionWithUrls)
				return
			}

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

func (api *ExtensionsApi) writeJSONMessage(connection *websocketConnection, statusUpdate *notification) error {
	message := websocketMessage{Event: statusUpdate.Event, Data: statusUpdate.Data, Version: api.Version}
	connection.SetWriteDeadline(time.Now().Add(1 * time.Second))
	return connection.WriteJSON(message)
}

func (api *ExtensionsApi) handleClientMessages(ws *websocketConnection) {
	for {
		_, message, err := ws.ReadMessage()
		if err != nil {
			break
		}

		jsonMessage := websocketClientMessage{}

		err = json.Unmarshal(message, &jsonMessage)
		if err != nil {
			log.Printf("failed to read client JSON message %v", err)
		}

		switch jsonMessage.Event {
		case "update":
			data := updateData{}
			if err := json.Unmarshal(jsonMessage.Data, &data); err != nil {
				break
			}
			_, updated := api.getMergedAppMap(data.App, true)
			if updated {
				go api.sendUpdateEvent([]core.Extension{})
			}
			go api.Notify(data.Extensions)

		case "dispatch":
			go api.notifyClients(func(rootUrl string) (message notification, err error) {
				return api.getDispatchNotification(jsonMessage.Data, rootUrl)
			})
		}
	}
}

func setExtensionUrls(original core.Extension, rootUrl string) core.Extension {
	extension := core.Extension{}
	err := mergeWithOverwrite(&extension, &original)
	if err != nil {
		return original
	}

	extension.Development.Root.Url = fmt.Sprintf("%s%s", rootUrl, extension.UUID)

	for entry := range extension.Assets {
		name := extension.Assets[entry].Name
		rawSearchParams := extension.Assets[entry].RawSearchParams

		extension.Assets[entry] = core.Asset{
			RawSearchParams: rawSearchParams,
			Url:             fmt.Sprintf("%s/assets/%s.js%s", extension.Development.Root.Url, name, rawSearchParams),
			Name:            name,
		}
	}

	return extension
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

func mergeWithOverwrite(source interface{}, destination interface{}) error {
	// Allow overwriting existing data and allow setting booleans to false
	// There is a weird quirk in the library where false is treated as empty
	// We need to use a custom transformer to fix this issue because universally allowing
	// overwriting with empty values leads to unexpected results overriding arrays and maps
	// https://github.com/imdario/mergo/issues/89#issuecomment-562954181
	return mergo.Merge(source, destination, mergo.WithOverride, mergo.WithTransformers(core.Extension{}))
}


func withCors(h http.Handler) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		rw.Header().Set("Access-Control-Allow-Origin", "*")
		rw.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		rw.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
		h.ServeHTTP(rw, r)
	}
}

func handlerWithCors(responseFunc func(w http.ResponseWriter, r *http.Request)) http.HandlerFunc {
	return withCors(http.HandlerFunc(responseFunc))
}

type ExtensionsApi struct {
	*core.ExtensionService
	*mux.Router
	*root.RootHandler
	connections sync.Map
	apiRoot     string
	updates     sync.Map
}

type notification struct {
	Event string                 `json:"event"`
	Data  map[string]interface{} `json:"data"`
}

type websocketClientMessage struct {
	Event string
	Data  json.RawMessage
}

type updateData struct {
	App        core.App         `json:"app"`
	Extensions []core.Extension `json:"extensions"`
}

type websocketData struct {
	Extensions []map[string]interface{}
	App        map[string]interface{}
}

type websocketMessage struct {
	Event   string                 `json:"event"`
	Version string                 `json:"version"`
	Data    map[string]interface{} `json:"data"`
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

type notificationHandler func(notification)

type closeHandler func(code int, text string) error
