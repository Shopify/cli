package core

import (
	"fmt"
	"io"
	"path/filepath"
	"reflect"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	Checkout     string = "checkout"
	Admin        string = "admin"
	PostPurchase string = "post-purchase"
	POS          string = "pos"
)

func NewExtensionService(config *Config) *ExtensionService {
	// Create a copy so we don't mutate the configs
	extensions := []Extension{}
	for _, extension := range config.Extensions {
		// Structs inside of maps cannot be copied and have to be re-created
		extension.Assets = CreateAssetsEntries(&extension)
		extensions = append(extensions, extension)
	}
	// TODO: Improve this when we need to read more app configs,
	// for now we only know and care about api_key
	app := make(App)
	app["api_key"] = config.App.ApiKey

	apiRoot := "/extensions"

	var apiRootUrl string

	if config.PublicUrl != "" {
		apiRootUrl = fmt.Sprintf("%s%s", config.PublicUrl, apiRoot)
	} else {
		apiRootUrl = fmt.Sprintf("http://localhost:%d%s", config.Port, apiRoot)
	}

	service := ExtensionService{
		App:            app,
		Version:        "4",
		Extensions:     extensions,
		Port:           config.Port,
		Store:          config.Store,
		ApiRoot:        apiRoot,
		DevConsolePath: "/dev-console",
		ApiRootUrl:     apiRootUrl,
	}

	return &service
}

func CreateAssetsEntries(extension *Extension) map[string]Asset {
	assets := make(map[string]Asset)
	keys := make([]string, 0, len(extension.Development.Entries))

	for key := range extension.Development.Entries {
		keys = append(keys, key)
	}

	for entry := range keys {
		name := keys[entry]
		assets[name] = Asset{Name: name}
	}

	return assets
}

func normalizeConfig(config *Config) {
	// Normalize configs
	for index := range config.Extensions {
		config.Extensions[index].Assets = CreateAssetsEntries(&config.Extensions[index])

		if config.Extensions[index].Surface == "" {
			config.Extensions[index].Surface = GetSurface(&config.Extensions[index])
		}

		if config.Extensions[index].Capabilities.NetworkAccess == nil {
			config.Extensions[index].Capabilities.NetworkAccess = NewBoolPointer(false)
		}

		if config.Extensions[index].Development.Hidden == nil {
			config.Extensions[index].Development.Hidden = NewBoolPointer(false)
		}
	}

}

func LoadConfig(r io.Reader) (config *Config, err error) {
	config = &Config{}
	decoder := yaml.NewDecoder(r)
	err = decoder.Decode(config)
	normalizeConfig(config)
	return
}

type appYaml struct {
	ApiKey string `yaml:"api_key"`
}

type Config struct {
	App        appYaml     `yaml:"app"`
	Extensions []Extension `yaml:"extensions"`
	Port       int
	PublicUrl  string `yaml:"public_url"`
	Store      string `yaml:"store"`
}

type ExtensionService struct {
	App            App
	Extensions     []Extension
	Port           int
	Store          string
	Version        string
	ApiRootUrl     string
	ApiRoot        string `json:"-" yaml:"-"`
	DevConsolePath string `json:"-" yaml:"-"`
}

type Localization struct {
	DefaultLocale string                 `json:"defaultLocale" yaml:"default_locale"`
	Translations  map[string]interface{} `json:"translations" yaml:"translations"`
	LastUpdated   int64                  `json:"lastUpdated" yaml:"lastUpdated"`
}

type Capabilities struct {
	NetworkAccess *bool `json:"networkAccess" yaml:"network_access"`
}

type Extension struct {
	Assets          map[string]Asset `json:"assets" yaml:"-"`
	Capabilities    Capabilities     `json:"capabilities" yaml:"capabilities,omitempty"`
	Development     Development      `json:"development" yaml:"development,omitempty"`
	ExtensionPoints []string         `json:"extensionPoints" yaml:"extension_points,omitempty"`
	Localization    *Localization    `json:"localization" yaml:"-"`
	Metafields      []Metafield      `json:"metafields" yaml:"metafields,omitempty"`
	Type            string           `json:"type" yaml:"type,omitempty"`
	UUID            string           `json:"uuid" yaml:"uuid,omitempty"`
	Version         string           `json:"version" yaml:"version,omitempty"`
	Surface         string           `json:"surface" yaml:"surface"`
	Title           string           `json:"title,omitempty" yaml:"title,omitempty"`
	Name            string           `json:"name,omitempty" yaml:"name,omitempty"`
	NodeExecutable  string           `json:"-" yaml:"node_executable,omitempty"`
}

func (e Extension) String() string {
	if e.Name != "" {
		return e.Name
	} else if e.Title != "" {
		return e.Title
	} else {
		return fmt.Sprintf("%s (%s)", e.Type, e.UUID)
	}
}

func (e Extension) BuildDir() string {
	return filepath.Join(".", e.Development.RootDir, e.Development.BuildDir)
}

type Asset struct {
	Name        string `json:"name" yaml:"name"`
	Url         string `json:"url" yaml:"url"`
	LastUpdated int64  `json:"lastUpdated" yaml:"lastUpdated"`
}

type commandConfig struct {
	Env map[string]string `json:"-" yaml:"env,omitempty"`
}

type Development struct {
	Build              commandConfig     `json:"-" yaml:"build,omitempty"`
	BuildDir           string            `json:"-" yaml:"build_dir,omitempty"`
	Develop            commandConfig     `json:"-" yaml:"develop,omitempty"`
	Entries            map[string]string `json:"-" yaml:"entries,omitempty"`
	Resource           Url               `json:"resource" yaml:"resource,omitempty"`
	Renderer           Renderer          `json:"-" yaml:"renderer,omitempty"`
	Root               Url               `json:"root" yaml:"root,omitempty"`
	RootDir            string            `json:"-" yaml:"root_dir,omitempty"`
	Hidden             *bool             `json:"hidden" yaml:"-"`
	Status             string            `json:"status" yaml:"-"`
	LocalizationStatus string            `json:"localizationStatus" yaml:"-"`
	Template           string            `json:"-" yaml:"template,omitempty"`
}

func (e Extension) UsesNext() bool {
	return strings.HasSuffix(e.Type, "_next")
}

func (e Extension) NormalizedType() string {
	return strings.Replace(e.Type, "_next", "", -1)
}

func (d Development) UsesReact() bool {
	return strings.Contains(d.Template, "react")
}

func (d Development) UsesTypeScript() bool {
	return strings.Contains(d.Template, "typescript")
}

type Renderer struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type Metafield struct {
	Namespace string `json:"namespace" yaml:"namespace"`
	Key       string `json:"key" yaml:"key"`
}

type App map[string]interface{}

type Url struct {
	Url string `json:"url" yaml:"url"`
}

/**
 * A custom transformer for mergo with the following rules:
 *
 * 1. Allow booleans with false values to override true values. There is a weird quirk in the library where false is treated as empty.
 * We need to use a custom transformer to fix this issue because universally allowing
 * overwriting with empty values leads to unexpected results overriding arrays and maps
 * see here for more info: https://github.com/imdario/mergo/issues/89#issuecomment-562954181
 *
 * 2. Allow overwriting Localization data completely if it has been set
 */
func (t Extension) Transformer(typ reflect.Type) func(dst, src reflect.Value) error {
	if typ.Kind() == reflect.Bool {
		return func(dst, src reflect.Value) error {
			dst.SetBool(src.Bool())
			return nil
		}
	}

	// if typ.Name() == "Url" {
	// 	return func(dst, src reflect.Value) error {
	// 		fmt.Printf("type %v interface %v", src.Type(), src.Interface())
	// 		if src.String() == "" {
	// 			dst.SetString(src.String())
	// 		}
	// 		return nil
	// 	}
	// }

	if typ.Kind() == reflect.Struct && typ.Name() == "Localization" {
		return func(dst, src reflect.Value) error {
			for i := 0; i < src.NumField(); i++ {
				srcValue := src.Field(i)
				if dst.Field(i).IsValid() {
					dst.Field(i).Set(srcValue)
				}
			}
			return nil
		}
	}

	return nil
}

func GetSurface(extension *Extension) string {
	if strings.Contains(extension.Development.Renderer.Name, "checkout") {
		return Checkout
	}
	if strings.Contains(extension.Development.Renderer.Name, "post-purchase") {
		return PostPurchase
	}
	if strings.Contains(extension.Development.Renderer.Name, "retail") {
		return POS
	}
	return Admin
}

func NewBoolPointer(boolState bool) *bool {
	boolPointer := new(bool)
	*boolPointer = boolState
	return boolPointer
}

func NewStringPointer(value string) *string {
	stringPointer := new(string)
	*stringPointer = value
	return stringPointer
}

type Fragment map[string]interface{}

type JsonFragment struct {
	Fragment `json:"-"`
}
