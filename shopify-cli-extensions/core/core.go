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
)

func NewExtensionService(config *Config, apiRoot string) *ExtensionService {
	// Create a copy so we don't mutate the configs
	extensions := []Extension{}
	for _, extension := range config.Extensions {
		extension.Assets = make(map[string]Asset)
		keys := make([]string, 0, len(extension.Development.Entries))

		for key := range extension.Development.Entries {
			keys = append(keys, key)
		}

		for entry := range keys {
			name := keys[entry]
			extension.Assets[name] = Asset{Name: name}
		}
		extension.Surface = GetSurface(&extension)
		extensions = append(extensions, extension)
	}
	// TODO: Improve this when we need to read more app configs,
	// for now we only know and care about api_key
	app := make(App)
	app["api_key"] = config.App.ApiKey

	service := ExtensionService{
		App:        app,
		Version:    "3",
		Extensions: extensions,
		Port:       config.Port,
		Store:      config.Store,
	}

	return &service
}

func LoadConfig(r io.Reader) (config *Config, err error) {
	config = &Config{}
	decoder := yaml.NewDecoder(r)
	err = decoder.Decode(config)
	return
}

type appYaml struct {
	ApiKey string `yaml:"api_key"`
}

type Config struct {
	App        appYaml     `yaml:"app"`
	Extensions []Extension `yaml:"extensions"`
	Port       int
	IntegrationContext `yaml:",inline"`
}

type IntegrationContext struct {
	PublicUrl  string `yaml:"public_url"`
	Store      string `yaml:"store"`
}

type ExtensionService struct {
	App        App
	Extensions []Extension
	Port       int
	Store      string
	Version    string
	PublicUrl  string
}

type Extension struct {
	Assets          map[string]Asset `json:"assets" yaml:"-"`
	Development     Development      `json:"development" yaml:"development,omitempty"`
	ExtensionPoints []string         `json:"extensionPoints" yaml:"extension_points,omitempty"`
	Metafields      []Metafield      `json:"metafields" yaml:"metafields,omitempty"`
	Type            string           `json:"type" yaml:"type,omitempty"`
	UUID            string           `json:"uuid" yaml:"uuid,omitempty"`
	Version         string           `json:"version" yaml:"version,omitempty"`
	Surface         string           `json:"surface" yaml:"-"`
	Title           string           `json:"title,omitempty" yaml:"title,omitempty"`
	Name            string           `json:"name,omitempty" yaml:"name,omitempty"`
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
	Build    commandConfig     `json:"-" yaml:"build,omitempty"`
	BuildDir string            `json:"-" yaml:"build_dir,omitempty"`
	Develop  commandConfig     `json:"-" yaml:"develop,omitempty"`
	Entries  map[string]string `json:"-" yaml:"entries,omitempty"`
	Resource Url               `json:"resource" yaml:"resource,omitempty"`
	Renderer Renderer          `json:"-" yaml:"renderer,omitempty"`
	Root     Url               `json:"root" yaml:"root,omitempty"`
	RootDir  string            `json:"-" yaml:"root_dir,omitempty"`
	Hidden   bool              `json:"hidden" yaml:"-"`
	Status   string            `json:"status" yaml:"-"`
	Template string            `json:"-" yaml:"template,omitempty"`
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

func (t Extension) Transformer(typ reflect.Type) func(dst, src reflect.Value) error {
	if typ.Kind() == reflect.Bool {
		return func(dst, src reflect.Value) error {
			dst.SetBool(src.Bool())
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
	return Admin
}
