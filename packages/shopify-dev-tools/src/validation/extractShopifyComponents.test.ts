import { describe, expect, it } from "vitest";
import { extractShopifyComponents } from "./extractShopifyComponents";

describe("extractShopifyComponents", () => {
  describe("main function routing", () => {
    it("returns empty array for undefined packageName", () => {
      const content = `declare const tagName = 's-button';`;
      expect(extractShopifyComponents(content, undefined)).toEqual([]);
    });

    it("returns empty array for unknown package names", () => {
      const content = `declare const tagName = 's-button';`;
      expect(
        extractShopifyComponents(content, "@shopify/unknown-package"),
      ).toEqual([]);
      expect(extractShopifyComponents(content, "some-other-package")).toEqual(
        [],
      );
    });

    it("routes @shopify/polaris-types to web component extractor", () => {
      const content = `declare const tagName = 's-button';`;
      expect(
        extractShopifyComponents(content, "@shopify/polaris-types"),
      ).toEqual(["s-button"]);
    });

    it("routes @shopify/ui-extensions to web component extractor", () => {
      const content = `declare const tagName = 's-text';`;
      expect(
        extractShopifyComponents(content, "@shopify/ui-extensions"),
      ).toEqual(["s-text"]);
    });

    it("routes @shopify/app-bridge-types to app bridge extractor", () => {
      const content = `interface AppBridgeElements { 'ui-modal': UIModalAttributes; }`;
      expect(
        extractShopifyComponents(content, "@shopify/app-bridge-types"),
      ).toEqual(["ui-modal"]);
    });

    it("routes @shopify/hydrogen to hydrogen extractor", () => {
      const content = `declare function CartForm(): JSX.Element;`;
      expect(extractShopifyComponents(content, "@shopify/hydrogen")).toEqual([
        "CartForm",
      ]);
    });

    it("routes @shopify/ui-extensions-react to react bindings extractor", () => {
      const content = `export declare const AdminAction: "AdminAction" & { ... };`;
      expect(
        extractShopifyComponents(content, "@shopify/ui-extensions-react"),
      ).toEqual(["AdminAction"]);
    });
  });

  describe("extractWebComponentTagNames (via polaris-types)", () => {
    const packageName = "@shopify/polaris-types";

    describe("Pattern 1: declare const tagName", () => {
      it("extracts tag name with single quotes", () => {
        const content = `declare const tagName = 's-button';`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "s-button",
        ]);
      });

      it("extracts tag name with double quotes", () => {
        const content = `declare const tagName = "s-avatar";`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "s-avatar",
        ]);
      });

      it("extracts tag name with numbered suffix (tagName$X pattern)", () => {
        const content = `declare const tagName$1 = 's-avatar';`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "s-avatar",
        ]);
      });

      it("extracts multiple numbered tag names", () => {
        const content = `
          declare const tagName$1 = 's-button';
          declare const tagName$2 = "s-avatar";
          declare const tagName$3 = 's-text';
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "s-button",
          "s-avatar",
          "s-text",
        ]);
      });

      it("extracts tag name with alphanumeric suffix", () => {
        const content = `declare const tagName$abc123 = 's-card';`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "s-card",
        ]);
      });
    });

    describe("Pattern 2: HTMLElementTagNameMap and IntrinsicElements", () => {
      it("extracts from HTMLElementTagNameMap with single quotes", () => {
        const content = `
          interface HTMLElementTagNameMap {
            ['s-customer-account-action']: SCustomerAccountActionElement;
          }
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "s-customer-account-action",
        ]);
      });

      it("extracts from HTMLElementTagNameMap with double quotes", () => {
        const content = `
          interface HTMLElementTagNameMap {
            ["s-button"]: SButtonElement;
          }
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "s-button",
        ]);
      });

      it("extracts from IntrinsicElements", () => {
        const content = `
          interface IntrinsicElements {
            ['s-text']: STextProps;
            ['s-card']: SCardProps;
          }
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "s-text",
          "s-card",
        ]);
      });

      it("extracts multi-part component names", () => {
        const content = `
          interface HTMLElementTagNameMap {
            ['s-customer-account-action-button']: SCustomerAccountActionButtonElement;
          }
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "s-customer-account-action-button",
        ]);
      });
    });

    describe("deduplication", () => {
      it("deduplicates components appearing in both HTMLElementTagNameMap and IntrinsicElements", () => {
        const content = `
          interface HTMLElementTagNameMap {
            ['s-button']: SButtonElement;
          }
          interface IntrinsicElements {
            ['s-button']: SButtonProps;
          }
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "s-button",
        ]);
      });

      it("deduplicates components from multiple patterns", () => {
        const content = `
          declare const tagName = 's-button';
          interface HTMLElementTagNameMap {
            ['s-button']: SButtonElement;
          }
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "s-button",
        ]);
      });
    });

    describe("edge cases", () => {
      it("returns empty array for content with no matches", () => {
        const content = `export const something = 'value';`;
        expect(extractShopifyComponents(content, packageName)).toEqual([]);
      });

      it("returns empty array for empty content", () => {
        expect(extractShopifyComponents("", packageName)).toEqual([]);
      });

      it("does not match non-hyphenated names in bracket pattern", () => {
        const content = `
          interface HTMLElementTagNameMap {
            ['button']: ButtonElement;
          }
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([]);
      });
    });
  });

  describe("extractWebComponentTagNames (via ui-extensions)", () => {
    const packageName = "@shopify/ui-extensions";

    it("extracts POS ui-extensions components", () => {
      const content = `
        declare const tagName$1 = 's-pos-tile';
        declare const tagName$2 = 's-pos-button';
      `;
      expect(extractShopifyComponents(content, packageName)).toEqual([
        "s-pos-tile",
        "s-pos-button",
      ]);
    });

    it("extracts customer-account ui-extensions components", () => {
      const content = `
        interface HTMLElementTagNameMap {
          ['s-customer-account-action']: SCustomerAccountActionElement;
          ['s-customer-account-button']: SCustomerAccountButtonElement;
        }
      `;
      expect(extractShopifyComponents(content, packageName)).toEqual([
        "s-customer-account-action",
        "s-customer-account-button",
      ]);
    });
  });

  describe("extractAppBridgeElements", () => {
    const packageName = "@shopify/app-bridge-types";

    it("extracts single element from AppBridgeElements interface", () => {
      const content = `
        interface AppBridgeElements {
          'ui-modal': UIModalAttributes;
        }
      `;
      expect(extractShopifyComponents(content, packageName)).toEqual([
        "ui-modal",
      ]);
    });

    it("extracts multiple elements from AppBridgeElements interface", () => {
      const content = `
        interface AppBridgeElements {
          'ui-modal': UIModalAttributes;
          'ui-title-bar': UITitleBarAttributes;
          'ui-nav-menu': UINavMenuAttributes;
        }
      `;
      expect(extractShopifyComponents(content, packageName)).toEqual([
        "ui-modal",
        "ui-title-bar",
        "ui-nav-menu",
      ]);
    });

    it("extracts elements with double quotes", () => {
      const content = `
        interface AppBridgeElements {
          "ui-modal": UIModalAttributes;
        }
      `;
      expect(extractShopifyComponents(content, packageName)).toEqual([
        "ui-modal",
      ]);
    });

    it("extracts elements with mixed quotes", () => {
      const content = `
        interface AppBridgeElements {
          'ui-modal': UIModalAttributes;
          "ui-title-bar": UITitleBarAttributes;
        }
      `;
      expect(extractShopifyComponents(content, packageName)).toEqual([
        "ui-modal",
        "ui-title-bar",
      ]);
    });

    it("returns empty array when AppBridgeElements interface is not present", () => {
      const content = `
        interface SomeOtherInterface {
          'ui-modal': UIModalAttributes;
        }
      `;
      expect(extractShopifyComponents(content, packageName)).toEqual([]);
    });

    it("returns empty array for empty content", () => {
      expect(extractShopifyComponents("", packageName)).toEqual([]);
    });

    it("returns empty array when interface is empty", () => {
      const content = `interface AppBridgeElements {}`;
      expect(extractShopifyComponents(content, packageName)).toEqual([]);
    });

    it("does not match non-hyphenated keys", () => {
      const content = `
        interface AppBridgeElements {
          'modal': ModalAttributes;
        }
      `;
      expect(extractShopifyComponents(content, packageName)).toEqual([]);
    });
  });

  describe("extractHydrogenComponents", () => {
    const packageName = "@shopify/hydrogen";

    describe("Pattern 1: JSX.Element return type", () => {
      it("extracts function returning JSX.Element", () => {
        const content = `declare function CartForm(): JSX.Element;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "CartForm",
        ]);
      });

      it("extracts function returning react_jsx_runtime.JSX.Element", () => {
        const content = `declare function ProductCard(): react_jsx_runtime.JSX.Element;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "ProductCard",
        ]);
      });

      it("extracts function with parameters", () => {
        const content = `declare function CartForm(props: CartFormProps): JSX.Element;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "CartForm",
        ]);
      });

      it("extracts function with generic type parameters", () => {
        const content = `declare function DataTable<T>(props: DataTableProps<T>): JSX.Element;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "DataTable",
        ]);
      });

      it("extracts multiple JSX.Element functions", () => {
        const content = `
          declare function CartForm(): JSX.Element;
          declare function ProductCard(): JSX.Element;
          declare function Collection(): react_jsx_runtime.JSX.Element;
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "CartForm",
          "ProductCard",
          "Collection",
        ]);
      });
    });

    describe("Pattern 2: ReturnType<FC> return type", () => {
      it("extracts function returning ReturnType<FC>", () => {
        const content = `declare function Button(): ReturnType<FC>;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "Button",
        ]);
      });

      it("extracts function with parameters returning ReturnType<FC>", () => {
        const content = `declare function Button(props: ButtonProps): ReturnType<FC>;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "Button",
        ]);
      });

      it("extracts function with generics returning ReturnType<FC>", () => {
        const content = `declare function List<T>(props: ListProps<T>): ReturnType<FC>;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "List",
        ]);
      });
    });

    describe("Pattern 3: react.FunctionComponentElement return type", () => {
      it("extracts function returning react.FunctionComponentElement", () => {
        const content = `declare function Card(): react.FunctionComponentElement<CardProps>;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "Card",
        ]);
      });

      it("extracts function with parameters returning react.FunctionComponentElement", () => {
        const content = `declare function Card(props: CardProps): react.FunctionComponentElement<CardProps>;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "Card",
        ]);
      });
    });

    describe("Pattern 4: react.ForwardRefExoticComponent", () => {
      it("extracts const with ForwardRefExoticComponent type", () => {
        const content = `declare const Link: react.ForwardRefExoticComponent<LinkProps>;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "Link",
        ]);
      });

      it("extracts multiple ForwardRefExoticComponent declarations", () => {
        const content = `
          declare const Link: react.ForwardRefExoticComponent<LinkProps>;
          declare const Input: react.ForwardRefExoticComponent<InputProps>;
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "Link",
          "Input",
        ]);
      });
    });

    describe("Pattern 5: react.Provider", () => {
      it("extracts const with Provider type", () => {
        const content = `declare const CartProvider: react.Provider<CartContextValue>;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "CartProvider",
        ]);
      });

      it("extracts multiple Provider declarations", () => {
        const content = `
          declare const CartProvider: react.Provider<CartContextValue>;
          declare const ShopProvider: react.Provider<ShopContextValue>;
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "CartProvider",
          "ShopProvider",
        ]);
      });
    });

    describe("mixed patterns", () => {
      it("extracts components from all patterns", () => {
        const content = `
          declare function CartForm(): JSX.Element;
          declare function Analytics(): ReturnType<FC>;
          declare function Card(): react.FunctionComponentElement<CardProps>;
          declare const Link: react.ForwardRefExoticComponent<LinkProps>;
          declare const CartProvider: react.Provider<CartContextValue>;
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "CartForm",
          "Analytics",
          "Card",
          "Link",
          "CartProvider",
        ]);
      });
    });

    describe("deduplication", () => {
      it("deduplicates components appearing multiple times", () => {
        const content = `
          declare function CartForm(): JSX.Element;
          declare function CartForm(): react_jsx_runtime.JSX.Element;
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "CartForm",
        ]);
      });
    });

    describe("edge cases", () => {
      it("returns empty array for content with no matches", () => {
        const content = `export const helper = () => {};`;
        expect(extractShopifyComponents(content, packageName)).toEqual([]);
      });

      it("returns empty array for empty content", () => {
        expect(extractShopifyComponents("", packageName)).toEqual([]);
      });

      it("does not match functions returning other types", () => {
        const content = `
          declare function getData(): Promise<Data>;
          declare function getConfig(): Config;
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([]);
      });

      it("does not match regular const declarations", () => {
        const content = `
          declare const config: Config;
          declare const options: Options;
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([]);
      });

      it("handles simple generic type parameters", () => {
        const content = `declare function Table<T>(props: TableProps<T>): JSX.Element;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "Table",
        ]);
      });

      it("does not match complex generic type parameters with nested angle brackets", () => {
        // Current regex limitation: nested angle brackets in generics are not supported
        const content = `declare function Table<T extends Record<string, unknown>>(props: TableProps<T>): JSX.Element;`;
        expect(extractShopifyComponents(content, packageName)).toEqual([]);
      });

      it("handles multiline function declarations", () => {
        const content = `
          declare function CartForm(
            props: CartFormProps
          ): JSX.Element;
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "CartForm",
        ]);
      });
    });
  });

  describe("extractReactBindingComponentNames (via ui-extensions-react)", () => {
    const packageName = "@shopify/ui-extensions-react";

    describe("Pattern 1: export declare const ComponentName", () => {
      it("extracts a single React binding from a leaf .d.ts file", () => {
        const content = `export declare const AdminAction: "AdminAction" & {
          readonly type?: "AdminAction" | undefined;
        };`;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "AdminAction",
        ]);
      });

      it("extracts multiple bindings from a single file", () => {
        const content = `
          export declare const Banner: "Banner" & { readonly type?: "Banner"; };
          export declare const Button: "Button" & { readonly type?: "Button"; };
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "Banner",
          "Button",
        ]);
      });

      it("does not match camelCase const exports (hooks / helpers)", () => {
        const content = `
          export declare const useApi: <T>(target: T) => Api<T>;
          export declare const reactExtension: (target: string, fn: () => Element) => void;
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([]);
      });

      it('does not match PascalCase const exports lacking the `"Name" &` shape', () => {
        // Insurance against drift if the tarball ever ships a PascalCase const
        // enum, Readonly record, etc. — only the literal-intersection shape
        // that actually backs a React component should be captured.
        const content = `
          export declare const HttpStatus: Readonly<{ Ok: 200; NotFound: 404; }>;
          export declare const Banner: SomeAlias;
          export declare const Card: "NotCard" & { readonly type?: "NotCard"; };
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([]);
      });
    });

    describe("Pattern 2: export { ... } barrel re-exports", () => {
      it("extracts components from a re-export list", () => {
        const content = `
          export { AdminAction } from './components/AdminAction/AdminAction';
          export { Banner } from './components/Banner/Banner';
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "AdminAction",
          "Banner",
        ]);
      });

      it("ignores type-only re-exports", () => {
        const content = `
          export { AdminAction } from './components/AdminAction/AdminAction';
          export type { AdminActionProps } from './components/AdminAction/AdminAction';
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "AdminAction",
        ]);
      });

      it("handles multi-name and aliased exports", () => {
        const content = `
          export { Banner, Section } from './components';
          export { reactExtension as render } from './render';
          export { Internal as PublicName } from './foo';
        `;
        // reactExtension → render is lowercase; PublicName from the alias is PascalCase.
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "Banner",
          "Section",
          "PublicName",
        ]);
      });

      it("does not match the literal `export type {` form", () => {
        const content = `
          export type { AdminActionProps } from './components/AdminAction/AdminAction';
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([]);
      });

      it("ignores inline `type` modifiers, including aliased forms", () => {
        const content = `
          export { Banner, type BannerProps } from './components/Banner';
          export { type AdminActionProps as RenamedProps } from './components/AdminAction';
        `;
        // Without the inline-type guard, the aliased form would leak
        // `RenamedProps` as a phantom JSX component.
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "Banner",
        ]);
      });
    });

    describe("mixed patterns and edge cases", () => {
      it("merges leaf and barrel matches without duplicates", () => {
        const content = `
          export declare const Banner: "Banner" & { ... };
          export { Banner } from './components/Banner/Banner';
        `;
        expect(extractShopifyComponents(content, packageName)).toEqual([
          "Banner",
        ]);
      });

      it("returns empty array for an unrelated module", () => {
        const content = `
          export * from './components';
          export declare function reactExtension(): void;
        `;
        // `export *` is a wildcard with no names to capture; `reactExtension`
        // is camelCase. Both correctly produce nothing.
        expect(extractShopifyComponents(content, packageName)).toEqual([]);
      });

      it("returns empty array for empty content", () => {
        expect(extractShopifyComponents("", packageName)).toEqual([]);
      });
    });
  });

  describe("@shopify/app-bridge-react", () => {
    const packageName = "@shopify/app-bridge-react";

    it("extracts React.ComponentType exports", () => {
      const content = `
export interface TitleBarProps {}
export declare const TitleBar: React.ComponentType<TitleBarProps>;
export declare const NavMenu: React.ComponentType<NavMenuProps>;
      `;
      expect(extractShopifyComponents(content, packageName).sort()).toEqual([
        "NavMenu",
        "TitleBar",
      ]);
    });

    it("extracts React.ForwardRefExoticComponent exports", () => {
      const content = `
export declare const Modal: React.ForwardRefExoticComponent<ModalProps & React.RefAttributes<UIModalElement>>;
export declare const SaveBar: React.ForwardRefExoticComponent<SaveBarProps & React.RefAttributes<UISaveBarElement>>;
      `;
      expect(extractShopifyComponents(content, packageName).sort()).toEqual([
        "Modal",
        "SaveBar",
      ]);
    });

    it("handles a mix of ComponentType and ForwardRefExoticComponent exports", () => {
      const content = `
export declare const TitleBar: React.ComponentType<TitleBarProps>;
export declare const Modal: React.ForwardRefExoticComponent<ModalProps & React.RefAttributes<UIModalElement>>;
      `;
      expect(extractShopifyComponents(content, packageName).sort()).toEqual([
        "Modal",
        "TitleBar",
      ]);
    });

    it("deduplicates repeated component declarations", () => {
      const content = `
export declare const TitleBar: React.ComponentType<TitleBarProps>;
export declare const TitleBar: React.ComponentType<TitleBarProps>;
      `;
      expect(extractShopifyComponents(content, packageName)).toEqual([
        "TitleBar",
      ]);
    });

    it("does not match lowercase `react.` (the Hydrogen extractor pattern)", () => {
      // Guards against accidentally double-matching Hydrogen-shaped
      // declarations from this extractor.
      const content = `
declare const Foo: react.ForwardRefExoticComponent<FooProps>;
      `;
      expect(extractShopifyComponents(content, packageName)).toEqual([]);
    });
  });
});
