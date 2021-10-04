package core

import (
	"io"
	"reflect"

	"gopkg.in/yaml.v3"
)

func NewExtensionService(config *Config, apiRoot string) *ExtensionService {
	// Create a copy so we don't mutate the configs
	extensions := []Extension{}
	for _, extension := range config.Extensions {
		extension.Assets = make(map[string]Asset)
		extensions = append(extensions, extension)
	}
	// TODO: Improve this when we need to read more app configs,
	// for now we only know and care about api_key
	app := make(App)
	app["api_key"] = config.App.ApiKey

	service := ExtensionService{
		App:        app,
		Version:    "0.1.0",
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
	PublicUrl  string `yaml:"public_url"`
	Store      string
}

type ExtensionService struct {
	App        App
	Extensions []Extension
	Port       int
	Store      string
	Version    string
}

type Extension struct {
	Type        string           `json:"type" yaml:"type"`
	UUID        string           `json:"uuid" yaml:"uuid"`
	Assets      map[string]Asset `json:"assets" yaml:"-"`
	Development Development      `json:"development" yaml:"development"`
	User        User             `json:"user" yaml:"user"`
	Version     string           `json:"version" yaml:"version"`
}

type Asset struct {
	Name string `json:"name" yaml:"name"`
	Url  string `json:"url" yaml:"url"`
}

type Development struct {
	Root     Url               `json:"root"`
	Resource Url               `json:"resource"`
	Renderer Renderer          `json:"-" yaml:"renderer"`
	Hidden   bool              `json:"hidden"`
	BuildDir string            `json:"-" yaml:"build_dir"`
	RootDir  string            `json:"-" yaml:"root_dir"`
	Template string            `json:"-"`
	Entries  map[string]string `json:"-"`
	Status   string            `json:"status"`
}

type Renderer struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type User struct {
	Metafields []Metafield `json:"metafields" yaml:"metafields"`
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
