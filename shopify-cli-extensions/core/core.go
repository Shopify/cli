package core

func NewExtensionService(buildDir string) *ExtensionService {
	service := ExtensionService{Version: "0.1.0"}

	service.Add(Extension{
		Assets: make([]Asset, 0),
		User: User{
			Metafields: make([]Metafield, 0),
		},
		Development: Development{
			BuildDir: buildDir,
		},
		App: make(App),
	})

	return &service
}

type ExtensionService struct {
	Extensions []Extension `json:"extensions"`
	Version    string      `json:"version"`
}

func (s *ExtensionService) Add(extension Extension) {
	s.Extensions = append(s.Extensions, extension)
}

type Extension struct {
	Type        string      `json:"type"`
	UUID        string      `json:"uuid"`
	Assets      []Asset     `json:"assets"`
	Development Development `json:"development"`
	User        User        `json:"user"`
	App         App         `json:"app"`
	Version     string      `json:"version"`
}

type Asset struct {
	Url `json:"url"`
}

type Development struct {
	Home     Url      `json:"home"`
	Manifest Url      `json:"manifest"`
	Status   Url      `json:"status"`
	Mobile   Url      `json:"mobile"`
	Resource Url      `json:"resource"`
	Renderer Renderer `json:"renderer"`
	Hidden   bool     `json:"hidden"`
	Focused  bool     `json:"focused"`
	BuildDir string   `json:"-"`
}

type Renderer struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type User struct {
	Metafields []Metafield `json:"metafields"`
}

type Metafield struct {
	Namespace string `json:"namespace"`
	Key       string `json:"key"`
}

type App map[string]interface{}

type Url struct {
	Url string `json:"url"`
}
