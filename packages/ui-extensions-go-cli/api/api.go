// The API package implements an HTTP interface that is responsible for
// - serving build artifacts
// - sending build status updates via websocket
// - provide metadata in form of a manifest to the UI Extension host on the client
//
package api

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/Shopify/shopify-cli-extensions/api/root"
	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/logging"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/iancoleman/strcase"
	"github.com/imdario/mergo"
)

//go:embed dev-console/*
var devConsole embed.FS

func New(config *core.Config, logBuilder *logging.LogEntryBuilder) *ExtensionsApi {
	mux := mux.NewRouter()
	apiLogBuilder := logBuilder.AddWorkflowSteps(logging.Api)
	api := configureExtensionsApi(config, mux, &apiLogBuilder)

	return api
}

func (api *ExtensionsApi) sendUpdateEvent(extensions []core.Extension) {
	api.notifyClients(func() (message notification, err error) {
		return api.getNotification("update", extensions)
	})
}

func (api *ExtensionsApi) notifyClients(createNotification func() (message notification, err error)) {
	api.connections.Range(func(connection, clientHandlers interface{}) bool {
		notification, err := createNotification()
		if err != nil {
			api.LogEntryBuilder.SetStatus(logging.Failure)
			api.LogEntryBuilder.Build(fmt.Sprintf("failed to construct notification with error: %v", err)).WriteErrorLog(os.Stdout)
			return false
		}
		clientHandlers.(client).notify(notification)
		return true
	})
}

func (api *ExtensionsApi) getNotification(event string, extensions []core.Extension) (message notification, err error) {
	extensionsWithUrls := getExtensionsWithUrl(extensions, api.ApiRootUrl)
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
	data["store"] = api.Store

	return
}

// Returns a notification that combines arbitrary data
// with the API's own data for app and extensions
func (api *ExtensionsApi) getDispatchNotification(rawData json.RawMessage) (message notification, err error) {
	dispatchData := make(map[string]interface{})
	if err = json.Unmarshal(rawData, &dispatchData); err != nil {
		return
	}

	data := websocketData{}
	if err = json.Unmarshal(rawData, &data); err != nil {
		return
	}

	mergedApp, _ := api.getMergedAppMap(data.App, false)
	extensions := api.getMergedExtensionsMap(data.Extensions)

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

func interfaceToMap(data interface{}, logBuilder logging.LogEntryBuilder) (result map[string]interface{}, err error) {
	logBuilder.SetStatus(logging.Failure)
	converted, err := json.Marshal(data)
	if err != nil {
		logBuilder.Build(fmt.Sprintf("error converting to JSON %v", err)).WriteErrorLog(os.Stdout)
		return
	}
	if err = json.Unmarshal(converted, &result); err != nil {
		logBuilder.Build(fmt.Sprintf("error converting to map %v", err)).WriteErrorLog(os.Stdout)
		return
	}
	return
}

func (api *ExtensionsApi) getMergedAppMap(additionalInfo map[string]interface{}, overwrite bool) (app map[string]interface{}, updated bool) {
	app = formatData(api.App, strcase.ToLowerCamel)
	if additionalInfo["apiKey"] == app["apiKey"] {
		if err := mergo.MapWithOverwrite(&app, additionalInfo); err != nil {
			api.LogEntryBuilder.SetStatus(logging.Failure)
			api.LogEntryBuilder.Build(fmt.Sprintf("error merging app info, %v", err)).WriteErrorLog(os.Stdout)
			return
		}

		if overwrite {
			if err := mergo.MapWithOverwrite(&api.App, formatData(app, strcase.ToSnake)); err != nil {
				api.LogEntryBuilder.SetStatus(logging.Failure)
				api.LogEntryBuilder.Build(fmt.Sprintf("error merging app info, %v", err)).WriteErrorLog(os.Stdout)
				return
			}
		}
		updated = true
	}
	return
}

func (api *ExtensionsApi) getMergedExtensionsMap(extensions []map[string]interface{}) []map[string]interface{} {
	targetExtensions := make(map[string]map[string]interface{})
	for _, extension := range extensions {
		targetExtensions[fmt.Sprintf("%v", extension["uuid"])] = extension
	}

	results := make([]map[string]interface{}, 0)
	for _, extension := range api.Extensions {
		if target, found := targetExtensions[extension.UUID]; found {
			extensionWithUrls := setExtensionUrls(extension, api.ApiRootUrl)
			extensionData, err := interfaceToMap(extensionWithUrls, api.LogEntryBuilder)
			if err != nil {
				continue
			}
			err = mergo.MapWithOverwrite(&extensionData, &target)
			if err != nil {
				api.LogEntryBuilder.SetStatus(logging.Failure)
				api.LogEntryBuilder.Build(fmt.Sprintf("failed to merge update data %v", err)).WriteErrorLog(os.Stdout)
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
				api.LogEntryBuilder.SetStatus(logging.Failure)
				api.LogEntryBuilder.Build(fmt.Sprintf("failed to merge update data %v", err)).WriteErrorLog(os.Stdout)
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
			err := mergeWithOverwrite(&api.Extensions[index], &castedData)
			if err != nil {
				api.LogEntryBuilder.SetStatus(logging.Failure)
				api.LogEntryBuilder.Build(fmt.Sprintf("failed to merge update data %v", err)).WriteErrorLog(os.Stdout)
			}
			updatedExtensions = append(updatedExtensions, api.Extensions[index])
		}
	}
	if len(updatedExtensions) == 0 {
		return
	}

	api.sendUpdateEvent(updatedExtensions)
}

func configureExtensionsApi(config *core.Config, router *mux.Router, logBuilder *logging.LogEntryBuilder) *ExtensionsApi {
	service := core.NewExtensionService(config)
	api := &ExtensionsApi{
		service,
		router,
		root.New(service),
		sync.Map{},
		sync.Map{},
		*logBuilder,
	}

	devConsoleServerPath := api.getDevConsoleServerPath()
	devConsoleServer := http.FileServer(http.FS(devConsole))

	// Redirect root url to /extensions/dev-console
	api.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
		url := r.URL
		url.Path = devConsoleServerPath
		http.Redirect(rw, r, url.String(), http.StatusTemporaryRedirect)
	})

	api.PathPrefix(devConsoleServerPath).Handler(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		r.URL.Path = api.getDevConsoleFilePath(r.URL.Path)
		devConsoleServer.ServeHTTP(rw, r)
	}))

	api.HandleFunc(api.ApiRoot+"/", handlerWithCors(api.extensionsHandler))
	api.HandleFunc(api.ApiRoot, handlerWithCors(api.extensionsHandler))

	for _, extension := range api.Extensions {
		assets := path.Join(api.ApiRoot, extension.UUID, "assets")
		buildDir := filepath.Join(".", extension.Development.RootDir, extension.Development.BuildDir)
		api.PathPrefix(assets).Handler(
			withoutCache(withCors(http.StripPrefix(assets, http.FileServer(http.Dir(buildDir))))),
		)
	}

	api.HandleFunc(path.Join(api.ApiRoot, "{uuid:(?:[a-z]|[0-9]|-)+\\/?}"), handlerWithCors(api.extensionRootHandler))

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

	connection := &websocketConnection{upgradedConnection, sync.Mutex{}}
	doOnce := sync.Once{}
	notifications := make(chan notification)
	done := make(chan struct{})

	closeConnection := func(closeCode int, message string) error {
		doOnce.Do(func() {
			close(done)
			close(notifications)
			api.unregisterClientAndNotify(connection, closeCode, message)
		})
		return nil
	}

	connection.SetCloseHandler(closeConnection)

	api.registerClient(connection, func(update notification) {
		notifications <- update
	}, closeConnection)

	notification, err := api.getNotification("connected", api.Extensions)
	if err != nil {
		closeConnection(websocket.CloseNoStatusReceived, fmt.Sprintf("cannot send connected message, failed with error: %v", err))
	}
	err = api.writeJSONMessage(connection, &notification)
	if err != nil {
		closeConnection(websocket.CloseNoStatusReceived, "cannot establish connection to client")
		return
	}

	go api.handleClientMessages(connection)

	for {
		select {
		case <-done:
			return
		case notification := <-notifications:

			err = api.writeJSONMessage(connection, &notification)
			if err != nil {
				// the client has closed the connection so we can return
				if errors.Is(err, syscall.EPIPE) {
					return
				}
				api.LogEntryBuilder.SetStatus(logging.Failure)
				api.LogEntryBuilder.Build(fmt.Sprintf("error writing JSON message: %v", err)).WriteErrorLog(os.Stdout)
				break
			}
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

	extensions := getExtensionsWithUrl(api.Extensions, api.ApiRootUrl)

	encoder.Encode(extensionsResponse{
		api.getResponse(),
		extensions,
	})
}

func (api *ExtensionsApi) extensionRootHandler(rw http.ResponseWriter, r *http.Request) {
	requestUrl, err := url.Parse(r.RequestURI)

	if err != nil {
		rw.Write([]byte(fmt.Sprintf("not found: %v", err)))
		return
	}

	re := regexp.MustCompile(fmt.Sprintf(`^\/?%v\/(?P<uuid>([a-z]|[0-9]|-)+)\/?`, api.ApiRoot))
	matches := re.FindStringSubmatch(requestUrl.Path)
	uuidIndex := re.SubexpIndex("uuid")
	if uuidIndex < 0 || uuidIndex >= len(matches) {
		rw.Write([]byte("not found, extension has an invalid uuid"))
		return
	}

	uuid := matches[uuidIndex]

	for _, extension := range api.Extensions {
		if extension.UUID == uuid {
			extensionWithUrls := setExtensionUrls(extension, api.ApiRootUrl)

			if strings.HasPrefix(r.Header.Get("accept"), "text/html") {
				api.HandleHTMLRequest(rw, r, &extensionWithUrls)
				return
			}

			rw.Header().Add("Content-Type", "application/json")
			encoder := json.NewEncoder(rw)
			encoder.Encode(singleExtensionResponse{api.getResponse(), extensionWithUrls})
			return
		}
	}

	rw.Write([]byte(fmt.Sprintf("not found: %v", err)))
}

func (api *ExtensionsApi) registerClient(connection *websocketConnection, notify notificationHandler, close closeConnection) bool {
	api.connections.Store(connection, client{notify, close})
	return true
}

func (api *ExtensionsApi) unregisterClient(connection *websocketConnection, closeCode int, message string) {
	connection.Close()
	api.connections.Delete(connection)
}

func (api *ExtensionsApi) unregisterClientAndNotify(connection *websocketConnection, closeCode int, message string) {
	connection.mu.Lock()
	defer connection.mu.Unlock()
	connection.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(closeCode, message))
	api.unregisterClient(connection, closeCode, message)
}

func (api *ExtensionsApi) writeJSONMessage(connection *websocketConnection, statusUpdate *notification) error {
	connection.mu.Lock()
	defer connection.mu.Unlock()

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
			api.LogEntryBuilder.SetStatus(logging.Failure)
			api.LogEntryBuilder.Build(fmt.Sprintf("failed to read client JSON message %v", err)).WriteErrorLog(os.Stdout)
		}

		switch jsonMessage.Event {
		case "update":
			data := updateData{}
			if err := json.Unmarshal(jsonMessage.Data, &data); err != nil {
				break
			}
			_, updated := api.getMergedAppMap(data.App, true)
			if updated {
				api.sendUpdateEvent([]core.Extension{})
			}
			api.Notify(data.Extensions)

		case "dispatch":
			api.notifyClients(func() (message notification, err error) {
				return api.getDispatchNotification(jsonMessage.Data)
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

	u, err := url.Parse(rootUrl)

	if err != nil {
		return original
	}

	u.Path = path.Join(u.Path, extension.UUID)

	extension.Development.Root.Url = u.String()

	for entry := range extension.Assets {
		name := extension.Assets[entry].Name
		extension.Assets[entry] = core.Asset{
			LastUpdated: extension.Assets[entry].LastUpdated,
			Url:         fmt.Sprintf("%s/assets/%s.js", extension.Development.Root.Url, name),
			Name:        name,
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

func mergeWithOverwrite(destination interface{}, source interface{}) error {
	/**
	 * Allow overwriting existing data and also use a custom transformer with the following rules:
	 *
	 * 1. Allow booleans with false values to override true values. There is a weird quirk in the library where false is treated as empty.
	 * We need to use a custom transformer to fix this issue because universally allowing
	 * overwriting with empty values leads to unexpected results overriding arrays and maps
	 * see here for more info: https://github.com/imdario/mergo/issues/89#issuecomment-562954181
	 *
	 * 2. Allow overwriting Localization data completely if it has been set
	 */
	return mergo.Merge(destination, source, mergo.WithOverride, mergo.WithTransformers(core.Extension{}))
}

func (api *ExtensionsApi) GetWebsocketUrl() string {
	apiURl, _ := url.Parse(api.ApiRootUrl)
	apiURl.Scheme = "wss"
	return apiURl.String()
}

func (api *ExtensionsApi) GetDevConsoleUrl() string {
	apiURl, _ := url.Parse(api.ApiRootUrl)
	apiURl.Path = path.Join(api.ApiRoot, api.DevConsolePath)
	return apiURl.String()
}

func (api *ExtensionsApi) getResponse() *Response {
	return &Response{
		formatData(api.App, strcase.ToLowerCamel),
		api.Version,
		core.Url{Url: api.ApiRootUrl},
		core.Url{Url: api.GetWebsocketUrl()},
		core.Url{Url: api.GetDevConsoleUrl()},
		api.Store,
	}
}

func withCors(h http.Handler) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		rw.Header().Set("Access-Control-Allow-Origin", "*")
		rw.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		rw.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, ngrok-skip-browser-warning")
		h.ServeHTTP(rw, r)
	}
}

func withoutCache(h http.Handler) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		rw.Header().Set("Cache-Control", "no-cache")
		h.ServeHTTP(rw, r)
	}
}

func handlerWithCors(responseFunc func(w http.ResponseWriter, r *http.Request)) http.HandlerFunc {
	return withCors(http.HandlerFunc(responseFunc))
}

func (api *ExtensionsApi) getDevConsoleServerPath() string {
	return path.Join(api.ApiRoot, api.DevConsolePath)
}

func (api *ExtensionsApi) getDevConsoleFilePath(requestPath string) string {
	if strings.HasPrefix(strings.TrimPrefix(requestPath, api.getDevConsoleServerPath()), "/assets") {
		return path.Join(api.DevConsolePath, requestPath)
	}

	return strings.TrimPrefix(requestPath, api.ApiRoot)
}

type ExtensionsApi struct {
	*core.ExtensionService
	*mux.Router
	*root.RootHandler
	connections sync.Map
	updates     sync.Map
	logging.LogEntryBuilder
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
	Store      string
}

type websocketMessage struct {
	Event   string                 `json:"event"`
	Version string                 `json:"version"`
	Data    map[string]interface{} `json:"data"`
}

type Response struct {
	App        core.App `json:"app" yaml:"-"`
	Version    string   `json:"version"`
	Root       core.Url `json:"root"`
	Socket     core.Url `json:"socket"`
	DevConsole core.Url `json:"devConsole"`
	Store      string   `json:"store"`
}

type websocketConnection struct {
	*websocket.Conn
	mu sync.Mutex
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
	close  closeConnection
}

type notificationHandler func(notification)

type closeConnection func(code int, text string) error
