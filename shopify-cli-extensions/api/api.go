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
	"log"
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
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/iancoleman/strcase"
	"github.com/imdario/mergo"
)

//go:embed dev-console/*
var devConsole embed.FS

const (
	DevConsolePath string = "/dev-console"
)

func New(config *core.Config, apiRoot string) *ExtensionsApi {
	mux := mux.NewRouter()
	api := configureExtensionsApi(config, mux, apiRoot)

	return api
}

func (api *ExtensionsApi) sendUpdateEvent(extensions []core.Extension) {
	api.notifyClients(func(rootUrl string) (message notification, err error) {
		return api.getNotification("update", extensions, api.publicUrl)
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
	data["store"] = api.Store

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
						Name:        api.Extensions[index].Assets[entry].Name,
						LastUpdated: time.Now().Unix(),
					}
				}
			}
			err := mergeWithOverwrite(&api.Extensions[index], &castedData)
			if err != nil {
				log.Printf("failed to merge update data %v", err)
			}
			// manually overwite localization data
			if castedData.Localization != nil && (api.Extensions[index].Localization == nil || castedData.Localization.LastUpdated > api.Extensions[index].Localization.LastUpdated) {
				api.Extensions[index].Localization = castedData.Localization
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
		config.PublicUrl + "/extensions/",
	}

	devConsoleServerPath := getDevConsoleServerPath(apiRoot)
	devConsoleServer := http.FileServer(http.FS(devConsole))

	// Redirect root url to /extensions/dev-console
	api.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
		url := r.URL
		url.Path = devConsoleServerPath
		http.Redirect(rw, r, url.String(), http.StatusTemporaryRedirect)
	})

	api.PathPrefix(devConsoleServerPath).Handler(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		r.URL.Path = getDevConsoleFilePath(r.URL.Path, apiRoot)
		devConsoleServer.ServeHTTP(rw, r)
	}))

	api.HandleFunc(strings.TrimSuffix(apiRoot, "/"), handlerWithCors(api.extensionsHandler))
	api.HandleFunc(apiRoot, handlerWithCors(api.extensionsHandler))

	for _, extension := range api.Extensions {
		assets := path.Join(apiRoot, extension.UUID, "assets")
		buildDir := filepath.Join(".", extension.Development.RootDir, extension.Development.BuildDir)
		api.PathPrefix(assets).Handler(
			withoutCache(withCors(http.StripPrefix(assets, http.FileServer(http.Dir(buildDir))))),
		)
	}

	api.HandleFunc(path.Join(apiRoot, "{uuid:(?:[a-z]|[0-9]|-)+\\/?}"), handlerWithCors(api.extensionRootHandler))

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

	connection := &websocketConnection{upgradedConnection, api.GetApiRootUrlFromRequest(r), sync.Mutex{}}
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

	notification, err := api.getNotification("connected", api.Extensions, api.publicUrl)
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

				log.Printf("error writing JSON message: %v", err)
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

	extensions := getExtensionsWithUrl(api.Extensions, api.GetApiRootUrlFromRequest(r))

	encoder.Encode(extensionsResponse{
		api.getResponse(r),
		extensions,
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
			encoder.Encode(singleExtensionResponse{api.getResponse(r), extensionWithUrls})
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
				api.sendUpdateEvent([]core.Extension{})
			}
			api.Notify(data.Extensions)

		case "dispatch":
			api.notifyClients(func(rootUrl string) (message notification, err error) {
				return api.getDispatchNotification(jsonMessage.Data, api.publicUrl)
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

		extension.Assets[entry] = core.Asset{
			LastUpdated: extension.Assets[entry].LastUpdated,
			Url:         fmt.Sprintf("%s/assets/%s.js", extension.Development.Root.Url, name),
			Name:        name,
		}
	}

	return extension
}

func GetFileNames(folderPath string) ([]string, error) {
	files := []string{}
	items, err := os.ReadDir(folderPath)
	if err != nil {
		return files, err
	}
	for _, item := range items {
		if !item.IsDir() {
			files = append(files, item.Name())
		}
	}
	return files, nil
}

func GetMapFromJsonFile(filePath string) (map[string]interface{}, error) {
	var result map[string]interface{}

	byteValue, err := os.ReadFile(filePath)

	if err != nil {
		return result, err
	}

	err = json.Unmarshal([]byte(byteValue), &result)

	if err != nil {
		return result, err
	}

	return result, nil
}

func IsDefaultLocale(fileName string) bool {
	return strings.HasSuffix(fileName, ".default.json")
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

func (api *ExtensionsApi) getResponse(r *http.Request) *Response {
	return &Response{
		formatData(api.App, strcase.ToLowerCamel),
		api.Version,
		core.Url{Url: api.GetApiRootUrlFromRequest(r)},
		core.Url{Url: api.GetWebsocketUrlFromRequest(r)},
		api.Store,
	}
}

func withCors(h http.Handler) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		rw.Header().Set("Access-Control-Allow-Origin", "*")
		rw.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		rw.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
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

func getDevConsoleServerPath(apiRoot string) string {
	return path.Join(apiRoot, DevConsolePath)
}

func getDevConsoleFilePath(requestPath string, apiRoot string) string {
	if strings.HasPrefix(strings.TrimPrefix(requestPath, getDevConsoleServerPath(apiRoot)), "/assets") {
		return path.Join(DevConsolePath, requestPath)
	}

	return strings.TrimPrefix(requestPath, apiRoot)
}

type ExtensionsApi struct {
	*core.ExtensionService
	*mux.Router
	*root.RootHandler
	connections sync.Map
	apiRoot     string
	updates     sync.Map
	publicUrl   string
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
	App     core.App `json:"app" yaml:"-"`
	Version string   `json:"version"`
	Root    core.Url `json:"root"`
	Socket  core.Url `json:"socket"`
	Store   string   `json:"store"`
}

type websocketConnection struct {
	*websocket.Conn
	rootUrl string
	mu      sync.Mutex
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
