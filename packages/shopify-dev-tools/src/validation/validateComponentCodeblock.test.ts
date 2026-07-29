import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValidationResult } from "../types/index";

import { validateComponentCodeBlock } from "./validateComponentCodeBlock";

let callTracker = { count: 0 };

describe("TypeScript validateComponentCodeBlock", { timeout: 30_000 }, () => {
  beforeEach(() => {
    callTracker = { count: 0 };
  });

  afterEach(() => {
    callTracker = { count: 0 };
  });

  describe("Core Functionality", () => {
    describe("input validation", () => {
      it("handles empty code gracefully", async () => {
        const result = await validateComponentCodeBlock({
          code: "",
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toStrictEqual(
          "Validation failed: Invalid input: code is required",
        );
      });

      it("validation fails when apiName is invalid", async () => {
        const result = await validateComponentCodeBlock({
          code: "<s-button>Test</s-button>",
          apiName: "invalid-api" as any,
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toStrictEqual(
          "Validation failed: Unknown API: invalid-api",
        );
      });

      it("rejects <s-*> web components for admin 2025-07 (React-only, no per-target subpath)", async () => {
        // Regression: previously the synthesized
        // `import '@shopify/ui-extensions/<target>'` would fall through to a
        // newer @shopify/ui-extensions installed elsewhere on the host's disk,
        // silently activating its JSX augmentation. The validator must instead
        // see only the bundled 2025.7.4 surface barrel — which has no s-*
        // intrinsic elements — and reject web-component JSX.
        const result = await validateComponentCodeBlock({
          code: `const Extension = () => (<s-avatar src="x" initials="MR" alt="a" size="small-200" />);`,
          apiName: "polaris-admin-extensions",
          version: "2025-07",
          extensionTarget: "admin.order-details.block.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toContain("s-avatar");
      });

      it("rejects a typoed extension target on a modern version that ships a targets/ subtree", async () => {
        // Regression: previously, an unknown target on a 2025-10+ version
        // landed in the loader's `!targetContent` branch and silently fell
        // back to loading the whole surface tree — making the typo validate
        // as if it were a valid target. The validator must now fail fast
        // with a useful "Unknown extension target" message that lists what
        // IS supported.
        const result = await validateComponentCodeBlock({
          code: `const Extension = () => (<s-button>Click</s-button>);`,
          apiName: "polaris-admin-extensions",
          version: "2026-01",
          extensionTarget: "admin.product-detials.block.render", // typo
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toContain(
          "Unknown extension target 'admin.product-detials.block.render'",
        );
        expect(result.resultDetail).toContain(
          "admin.product-details.block.render",
        );
      });

      it("validation fails with a clear message when version is unsupported for the API", async () => {
        const result = await validateComponentCodeBlock({
          code: `<s-button>Click</s-button>`,
          apiName: "polaris-admin-extensions",
          version: "1999-01",
          extensionTarget: "admin.product-details.block.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toContain(
          "Version '1999-01' is not supported for API 'polaris-admin-extensions'",
        );
        expect(result.resultDetail).toContain("Supported versions:");
        expect(result.resultDetail).not.toContain(
          "Missing required dev dependencies",
        );
      });

      it("validation fails when missing apiName", async () => {
        const result = await validateComponentCodeBlock({
          code: "<s-button>Test</s-button>",
          apiName: "" as any,
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toStrictEqual(
          "Validation failed: Invalid input: apiName is required",
        );
      });

      it("validation fails when code is undefined/missing", async () => {
        const result = await validateComponentCodeBlock({
          code: undefined as any,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toStrictEqual(
          "Validation failed: Invalid input: code is required",
        );
      });
    });

    describe("basic component validation demonstrated with app-home", () => {
      it.each([
        ["s-button", `<s-button>Click me</s-button>`],
        ["s-text", `<s-text>Hello world</s-text>`],
        ["s-badge", `<s-badge>New</s-badge>`],
        ["s-banner", `<s-banner>Info</s-banner>`],
        ["s-box", `<s-box>Content</s-box>`],
        ["s-checkbox", `<s-checkbox />`],
        ["s-link", `<s-link>Click here</s-link>`],
      ])("validates %s component", async (component, code) => {
        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          `All components validated successfully by TypeScript. Found components: ${component}.`,
        );
      });

      it("validates components without imports", async () => {
        const code = `
<s-button>Click me</s-button>
<s-text>Hello world</s-text>
<s-badge>New</s-badge>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-button, s-text, s-badge.",
        );
      });

      it("includes user-defined components", async () => {
        const code = `
import { CustomButton } from './components';

<s-button>Shopify Button</s-button>
<CustomButton>User Button</CustomButton>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-button.\n\nTry and use component from Shopify Polaris components. Non-Shopify components (not validated):\n  - CustomButton",
        );
      });

      it("validates multiple components", async () => {
        const code = `
<s-page heading="My Page">
  <s-button>Button 1</s-button>
  <s-text>Some text</s-text>
</s-page>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-page, s-button, s-text.",
        );
      });
    });

    describe("props validation", () => {
      it("rejects invalid props", async () => {
        const code = `<s-button someMadeUpProp="value" disabled>Submit</s-button>`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        // Don't pin the generated `ReactProps$X` suffix — TypeScript renames
        // it across @shopify/polaris-types versions.
        expect(result.resultDetail).toContain("s-button validation failed");
        expect(result.resultDetail).toContain("someMadeUpProp");
        expect(result.resultDetail).toContain(
          "PreactBaseElementPropsWithChildren<Button>",
        );
      });

      it("accepts valid props with attributes", async () => {
        const code = `
<s-page heading="My Page">
  <s-button>Button 1</s-button>
  <s-text>Some text</s-text>
</s-page>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-page, s-button, s-text.",
        );
      });

      it("ignores module not found errors for non-Shopify packages", async () => {
        const code = `
import { nonExistent } from './does-not-exist';
import { alsoFake } from 'fake-package';
import something from 'another-fake';

<s-button>Test Button</s-button>
<s-text>Some text</s-text>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-button, s-text.",
        );
      });

      it("rejects invalid accessibilityVisibility enum value on s-text", async () => {
        const code = `<s-text accessibilityVisibility="invalid">Text content</s-text>`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toStrictEqual(
          "Validation errors:\n" +
            's-text validation failed: Property \'unknown\': Type \'"invalid"\' is not assignable to type \'"visible" | "hidden" | "exclusive"\'.',
        );
      });

      it("accepts valid accessibilityVisibility values on s-text", async () => {
        const code = `
<>
  <s-text accessibilityVisibility="visible">Visible text</s-text>
  <s-text accessibilityVisibility="hidden">Hidden text</s-text>
  <s-text accessibilityVisibility="exclusive">Screen reader only</s-text>
</>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-text.",
        );
      });
    });

    describe("HTML elements handling", () => {
      it("handles code with no Shopify components", async () => {
        const code = `
import { useState } from 'react';

<div>Just a regular HTML element</div>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "No components found to validate by TypeScript.\n\n" +
            "Try and use component from Shopify Polaris components. Non-Shopify components (not validated):\n" +
            "  - div",
        );
      });
    });

    describe("edge cases and error handling", () => {
      it("handles deeply nested components", async () => {
        const code = `
<s-page>
  <s-banner tone="critical" heading="Media upload failed">
    File extension doesn't match the format of the file.
  </s-banner>
  <s-section>
    <s-text-field label="Title"></s-text-field>
    <s-text-area label="Description"></s-text-area>
  </s-section>
  <s-section heading="Status" slot="aside">
    <s-select>
      <s-option value="active">Active</s-option>
      <s-option value="draft">Draft</s-option>
    </s-select>
  </s-section>
</s-page>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-page, s-banner, s-section, s-text-field, s-text-area, s-select, s-option.",
        );
      });

      it("rejects invalid props in deeply nested components", async () => {
        const code = `
<s-page>
  <s-banner invalidToneProp="danger" heading="Media upload failed">
    File extension doesn't match the format of the file.
  </s-banner>
  <s-section>
    <s-text-field label="Title" fakeAttribute="test"></s-text-field>
    <s-text-area wrongProp="Description"></s-text-area>
  </s-section>
  <s-section heading="Status" slot="aside">
    <s-select madeUpProp="value">
      <s-option invalidValue="active">Active</s-option>
      <s-option value="draft">Draft</s-option>
    </s-select>
  </s-section>
</s-page>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toContain("Validation errors:");
        expect(result.resultDetail).toContain("s-banner validation failed");
        expect(result.resultDetail).toContain("Property 'invalidToneProp'");
        expect(result.resultDetail).toContain("s-text-field validation failed");
        expect(result.resultDetail).toContain("Property 'fakeAttribute'");
        expect(result.resultDetail).toContain("s-text-area validation failed");
        expect(result.resultDetail).toContain("Property 'wrongProp'");
        expect(result.resultDetail).toContain("s-select validation failed");
        expect(result.resultDetail).toContain("Property 'madeUpProp'");
        expect(result.resultDetail).toContain("s-option validation failed");
        expect(result.resultDetail).toContain("Property 'invalidValue'");
      });

      it("accepts valid onClick handler", async () => {
        const code = `
<s-button onClick={() => {
  console.log('Button clicked!');
}}>Click me</s-button>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-button.",
        );
      });

      it("reports validation errors for malformed JSX (missing closing brace)", async () => {
        const code = `
<s-button onClick={() => {
  console.log('test')
>Click</s-button>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        // Malformed JSX produces TS2304 "Cannot find name 'X'" errors which
        // are no longer attributed to s-button (snippet-incompleteness can
        // produce the same code legitimately, e.g. `onClick={handleClick}`).
        // They surface as generic errors instead, so the block still fails.
        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toMatch(/Cannot find name/);
      });

      it("does not blame a Shopify component for an undefined handler identifier (snippet-incompleteness)", async () => {
        // Common doc-snippet pattern: model writes well-formed Polaris JSX
        // that references a handler defined elsewhere. The Polaris API usage
        // (onClick + function value) is correct; the only error is a TS2304
        // "Cannot find name 'handleClick'". That must not be reported as an
        // s-button validation failure.
        const code = `<s-button onClick={handleClick}>Save</s-button>`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.componentValidationErrors).toStrictEqual([]);
        // TS2304 still surfaces as a generic error (snippet is incomplete),
        // so the overall result is still FAILED — but the failure is not
        // attributed to s-button's Polaris API surface.
        expect(
          (result.genericErrors ?? []).some((e) =>
            /Cannot find name 'handleClick'/.test(e.message),
          ),
        ).toBe(true);
      });
    });
  });

  describe("Smoke tests asserting that specific APIs can validate components", () => {
    describe("Polaris Admin Extensions", () => {
      it("rejects invalid tone prop value on s-icon", async () => {
        const code = `<s-icon type="home" tone="primary" />`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-admin-extensions",
          extensionTarget: "admin.abandoned-checkout-details.action.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toStrictEqual(
          "Validation errors:\n" +
            's-icon validation failed: Property \'unknown\': Type \'"primary"\' is not assignable to type \'"info" | "auto" | "neutral" | "success" | "caution" | "warning" | "critical"\'.',
        );
      });

      it("accepts valid tone prop values on s-icon", async () => {
        const code = `
<s-stack direction="inline" gap="base">
  <s-icon type="alert-circle" tone="warning" />
  <s-icon type="check-circle" tone="success" />
  <s-icon type="info" tone="info" />
  <s-icon type="alert-triangle" tone="caution" />
  <s-icon type="home" tone="critical" />
  <s-icon type="settings" tone="neutral" />
  <s-icon type="product" tone="auto" />
</s-stack>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-admin-extensions",
          extensionTarget: "admin.abandoned-checkout-details.action.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-stack, s-icon.",
        );
      });

      it("validates multiple components in one code block", async () => {
        const code = `
<>
  <s-text>First</s-text>
  <s-button>Click</s-button>
  <s-text>Second</s-text>
</>`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-admin-extensions",
          extensionTarget: "admin.abandoned-checkout-details.action.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-text, s-button.",
        );
      });
    });

    describe("Polaris Checkout Extensions", () => {
      it("rejects invalid color prop enum value on s-badge", async () => {
        const code = `<s-badge color="primary">New</s-badge>`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-checkout-extensions",
          extensionTarget: "purchase.cart-line-item.line-components.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toStrictEqual(
          "Validation errors:\n" +
            "s-badge validation failed: Property 'unknown': Type '\"primary\"' is not assignable to type '\"subdued\" | \"base\"'.",
        );
      });

      it("accepts valid color prop values on s-badge", async () => {
        const code = `
<>
  <s-badge color="base">Default</s-badge>
  <s-badge color="subdued">Subdued</s-badge>
</>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-checkout-extensions",
          extensionTarget: "purchase.cart-line-item.line-components.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-badge.",
        );
      });
    });

    describe("Polaris Customer Account Extensions", () => {
      it("rejects s-customer-account-action without required heading prop", async () => {
        const code = `<s-customer-account-action>
  Modal content
  <s-button slot="primary-action">Save</s-button>
</s-customer-account-action>`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-customer-account-extensions",
          extensionTarget: "customer-account.footer.render-after",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toStrictEqual(
          "Validation errors:\n" +
            "s-customer-account-action validation failed: Property 'heading': Type '{ children: (string | Element)[]; }' is not assignable to type 'BaseElementPropsWithChildren<CustomerAccountActionElement> & CustomerAccountActionProps'.\n" +
            "  Property 'heading' is missing in type '{ children: (string | Element)[]; }' but required in type 'CustomerAccountActionProps'.",
        );
      });

      it("accepts s-customer-account-action with required heading prop", async () => {
        const code = `<s-customer-account-action heading="Action title">
  Modal content
  <s-button slot="primary-action">Save</s-button>
  <s-button slot="secondary-actions">Cancel</s-button>
</s-customer-account-action>`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-customer-account-extensions",
          extensionTarget: "customer-account.footer.render-after",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-customer-account-action, s-button.",
        );
      });

      it("rejects invalid props on components imported from purchase target", async () => {
        const code = `
import '@shopify/ui-extensions/purchase.checkout.block.render';
<s-stack invalidProp="test" gap="base">
  <s-text>Checkout content</s-text>
  <s-button>Continue</s-button>
</s-stack>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-checkout-extensions",
          extensionTarget: "purchase.cart-line-item.line-components.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toStrictEqual(
          "Validation errors:\n" +
            "s-stack validation failed: Property 'invalidProp': Type '{ children: Element[]; invalidProp: string; gap: \"base\"; }' is not assignable to type 'StackProps & BaseElementPropsWithChildren<StackElement>'.\n" +
            "  Property 'invalidProp' does not exist on type 'StackProps & BaseElementPropsWithChildren<StackElement>'.",
        );
      });

      it("accepts valid props on components imported from purchase target", async () => {
        const code = `
import '@shopify/ui-extensions/purchase.checkout.block.render';
<s-stack gap="base" direction="block">
  <s-text>Checkout content</s-text>
  <s-button>Continue</s-button>
</s-stack>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-checkout-extensions",
          extensionTarget: "purchase.cart-line-item.line-components.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-stack, s-text, s-button.",
        );
      });
    });

    describe("POS UI", () => {
      it("validates components without needing local package installation", async () => {
        const code = `
<s-page heading="My Page">
  <s-button>Click Me</s-button>
</s-page>`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "pos-ui",
          extensionTarget: "pos.cart.line-item-details.action.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-page, s-button.",
        );
      });

      it("detects invalid props on POS UI components", async () => {
        const code = `
<s-page invalidProp="test">
  <s-button invalidButtonProp="value">Test</s-button>
</s-page>`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "pos-ui",
          extensionTarget: "pos.cart.line-item-details.action.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toStrictEqual(
          "Validation errors:\n" +
            "s-page validation failed: Property 'invalidProp': Type '{ children: Element; invalidProp: string; }' is not assignable to type 'IntrinsicElementProps<ElementProps>'.\n" +
            "  Property 'invalidProp' does not exist on type 'IntrinsicElementProps<ElementProps>'.\n" +
            "s-button validation failed: Property 'invalidButtonProp': Type '{ children: string; invalidButtonProp: string; }' is not assignable to type 'IntrinsicElementProps<ButtonJSXProps>'.\n" +
            "  Property 'invalidButtonProp' does not exist on type 'IntrinsicElementProps<ButtonJSXProps>'.",
        );
      });

      it("rejects bad props on POS UI web components", async () => {
        const code = `
<>
  <s-banner heading="Info" variant="information">This is a banner</s-banner>
  <s-button onPress={() => {}}>Click</s-button>
</>
      `;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "pos-ui",
          extensionTarget: "pos.cart.line-item-details.action.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toStrictEqual(
          "Validation errors:\n" +
            "s-banner validation failed: Property 'variant': Type '{ children: string; heading: string; variant: string; }' is not assignable to type 'IntrinsicElementProps<ElementProps>'.\n" +
            "  Property 'variant' does not exist on type 'IntrinsicElementProps<ElementProps>'.\n" +
            "s-button validation failed: Property 'onPress': Type '{ children: string; onPress: () => void; }' is not assignable to type 'IntrinsicElementProps<ButtonJSXProps>'.\n" +
            "  Property 'onPress' does not exist on type 'IntrinsicElementProps<ButtonJSXProps>'.",
        );
      });
    });

    describe("Hydrogen", () => {
      it("validates Hydrogen components", async () => {
        const code = `import {type ActionFunctionArgs, data} from 'react-router';
import {
  type CartQueryDataReturn,
  type HydrogenCart,
  CartForm,
} from '@shopify/hydrogen';
import invariant from 'tiny-invariant';

export default function Cart() {
  return (
    <CartForm
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{
        lines: [
          {
            id: 'gid://shopify/CartLine/123456789',
            quantity: 3,
          },
        ],
        other: 'data',
      }}
    >
      <button>Quantity up</button>
    </CartForm>
  );
}

export async function action({request, context}: ActionFunctionArgs) {
  const cart = context.cart as HydrogenCart;
  // cart is type HydrogenCart or HydrogenCartCustom
  // Declare cart type in remix.env.d.ts for interface AppLoadContext to avoid type casting
  // const {cart} = context;

  const formData = await request.formData();
  const {action, inputs} = CartForm.getFormInput(formData);

  let status = 200;
  let result: CartQueryDataReturn;

  if (action === CartForm.ACTIONS.LinesUpdate) {
    result = await cart.updateLines(inputs.lines);
  } else {
    invariant(false, \`\${action} cart action is not defined\`);
  }

  const headers = cart.setCartId(result.cart.id);

  return data(result, {status, headers});
}`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "hydrogen",
          extensionTarget: "cart.action.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toBe(
          `All components validated successfully by TypeScript. Found components: CartForm.\n\nTry and use component from Shopify Polaris components. Non-Shopify components (not validated):\n  - button`,
        );
      });

      it("validates CartForm with OptimisticInput", async () => {
        const code = `import {CartForm, OptimisticInput, useOptimisticData} from '@shopify/hydrogen';
import {CartLine} from '@shopify/hydrogen-react/storefront-api-types';

type OptimisticData = {
  action: string;
};

export default function Cart({line}: {line: CartLine}) {
  const optimisticId = line.id;
  const optimisticData = useOptimisticData<OptimisticData>(optimisticId);

  return (
    <div
      style={{
        // Hide the line item if the optimistic data action is remove
        // Do not remove the form from the DOM
        display: optimisticData?.action === 'remove' ? 'none' : 'block',
      }}
    >
      <CartForm
        route="/cart"
        action={CartForm.ACTIONS.LinesRemove}
        inputs={{
          lineIds: [line.id],
        }}
      >
        <button type="submit">Remove</button>
        <OptimisticInput id={optimisticId} data={{action: 'remove'}} />
      </CartForm>
    </div>
  );
}`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "hydrogen",
          extensionTarget: "cart.action.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toBe(
          `All components validated successfully by TypeScript. Found components: CartForm, OptimisticInput.\n\nTry and use component from Shopify Polaris components. Non-Shopify components (not validated):\n  - div\n  - button`,
        );
      });

      it("validates Script component with nonce", async () => {
        const code = `import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';
import {useNonce, Script} from '@shopify/hydrogen';
export default function App() {
  const nonce = useNonce();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        {/* Note you don't need to pass a nonce to the script component 
        because it's automatically added */}
        <Script src="https://some-custom-script.js" />
        {/* For security, nonce is not supported with \`waitForHydration\`\.
        Instead you need to add the domain of the script directly to your
        Content Securitiy Policy directives. */}
        <Script
          waitForHydration
          src="https://domain.com/script-that-modifies-dom.js"
        />
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
        <LiveReload nonce={nonce} />
      </body>
    </html>
  );
}`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "hydrogen",
          extensionTarget: "cart.action.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toBe(
          `Validation errors:\nModule '"react-router"' has no exported member 'LiveReload'.\n\nTry and use component from Shopify Polaris components. Non-Shopify components (not validated):\n  - html\n  - head\n  - meta\n  - meta\n  - Meta\n  - Links\n  - body\n  - Outlet\n  - ScrollRestoration\n  - Scripts\n  - LiveReload`,
        );
      });

      it("validates ShopPayButton variants", async () => {
        const code = `import {ShopPayButton} from '@shopify/hydrogen';

export function AddVariantQuantity1({variantId, storeDomain}) {
  return <ShopPayButton variantIds={[variantId]} storeDomain={storeDomain} />;
}

export function AddVariantQuantityMultiple({variantId, quantity, storeDomain}) {
  return (
    <ShopPayButton
      variantIdsAndQuantities={[{id: variantId, quantity}]}
      storeDomain={storeDomain}
    />
  );
}

export function ChannelAttribution({channel, variantId, storeDomain}) {
  return (
    <ShopPayButton
      channel={channel}
      variantIds={[variantId]}
      storeDomain={storeDomain}
    />
  );
}`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "hydrogen",
          extensionTarget: "cart.action.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toBe(
          `All components validated successfully by TypeScript. Found components: ShopPayButton.`,
        );
      });

      it("validates Analytics.* compound components (dotted JSX)", async () => {
        const code = `import {Analytics} from '@shopify/hydrogen';

export default function Tracking() {
  return (
    <>
      <Analytics.CartView />
      <Analytics.ProductView data={{products: []}} />
    </>
  );
}`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "hydrogen",
          extensionTarget: "cart.action.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.validatedComponents).toEqual(
          expect.arrayContaining([
            "Analytics.CartView",
            "Analytics.ProductView",
          ]),
        );
      });

      it("detects invalid props on useCustomerPrivacy hook", async () => {
        const code = `import {useCustomerPrivacy} from '@shopify/hydrogen';
import {useEffect} from 'react';

export function MyComponent() {
  const {customerPrivacy, privacyBanner = null} = useCustomerPrivacy({
  invalidProp: 'test',
    storefrontAccessToken: '12345',
    checkoutDomain: 'checkout.example.com',
    onVisitorConsentCollected: (consent) => {
      console.log('Visitor consent collected:', consent);
    },
  });

  useEffect(() => {
    if (customerPrivacy) {
      // check if user has marketing consent
      console.log(
        'User marketing consent:',
        customerPrivacy.analyticsProcessingAllowed(),
      );

      // or set tracking consent
      customerPrivacy.setTrackingConsent(
        {
          marketing: true,
          analytics: true,
          preferences: true,
          sale_of_data: true,
        },
        (data) => {
          if (data?.error) {
            console.error('Error setting tracking consent:', data.error);
            return;
          }
          console.log('Tracking consent set');
        },
      );
    }

    if (privacyBanner) {
      privacyBanner.loadBanner();

      // or show banner with specific locale and country
      // privacyBanner.loadBanner({locale: 'FR', country: 'CA'});

      // or show consent preferences banner
      // privacyBanner.showPreferences()

      // or show consent preferences banner with specific locale and country
      // privacyBanner.showPreferences({locale: 'FR', country: 'CA'});
    }
  }, [customerPrivacy, privacyBanner]);
}`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "hydrogen",
          extensionTarget: "cart.action.render",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toBe(
          `Validation errors:\nObject literal may only specify known properties, and 'invalidProp' does not exist in type 'CustomerPrivacyApiProps'.`,
        );
      });
    });
  });

  describe("UI Extensions should not use HTML/SVG elements or custom components", () => {
    it("rejects HTML elements for POLARIS ADMIN EXTENSIONS", async () => {
      const code = `<div>Hello</div>`;
      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-admin-extensions",
        extensionTarget: "admin.abandoned-checkout-details.action.render",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
      expect(result.resultDetail).toContain(
        "Validation errors:\n" +
          "div validation failed: Property 'element': HTML element 'div' is not allowed. UI extensions must only use Shopify Polaris web components.",
      );
    });

    it("rejects SVG elements for POLARIS ADMIN EXTENSIONS", async () => {
      const code = `<clipPath>Hello</clipPath>`;
      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-admin-extensions",
        extensionTarget: "admin.abandoned-checkout-details.action.render",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
      expect(result.resultDetail).toContain(
        "Validation errors:\n" +
          "clipPath validation failed: Property 'element': SVG element 'clipPath' is not allowed. UI extensions must only use Shopify Polaris web components.",
      );
    });

    it("approves imported custom components for POLARIS ADMIN EXTENSIONS", async () => {
      // We assume that these imported components have only shopify components inside them.
      // Failing them without the import context may lead to bad validation results.
      const code = `import ComponentWithShopifyComponents from './ComponentWithShopifyComponents';
      import {ComponentWithShopifyComponents2} from './ComponentWithShopifyComponents2';
      <ComponentWithShopifyComponents>Click me</ComponentWithShopifyComponents>
      <ComponentWithShopifyComponents2>Click me</ComponentWithShopifyComponents2>`;
      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-admin-extensions",
        extensionTarget: "admin.abandoned-checkout-details.action.render",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      expect(result.resultDetail).toContain(
        "No components found to validate by TypeScript.\n" +
          "\nTry and use component from Shopify Polaris components. Non-Shopify components (not validated):\n" +
          "  - ComponentWithShopifyComponents\n" +
          "  - ComponentWithShopifyComponents2",
      );
    });

    it("rejects HTML/SVG elements for POLARIS CUSTOMER ACCOUNT EXTENSIONS", async () => {
      const code = `<div>Hello</div><clipPath>Hello</clipPath>`;
      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-customer-account-extensions",
        extensionTarget: "customer-account.footer.render-after",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
      expect(result.resultDetail).toContain(
        "Validation errors:\n" +
          "div validation failed: Property 'element': HTML element 'div' is not allowed. UI extensions must only use Shopify Polaris web components.\n" +
          "clipPath validation failed: Property 'element': SVG element 'clipPath' is not allowed. UI extensions must only use Shopify Polaris web components.",
      );
    });

    it("approves imported custom components for POLARIS CUSTOMER ACCOUNT EXTENSIONS", async () => {
      const code = `import ComponentWithShopifyComponents from './ComponentWithShopifyComponents';
      import {ComponentWithShopifyComponents2} from './ComponentWithShopifyComponents2';
      <ComponentWithShopifyComponents>Click me</ComponentWithShopifyComponents>
      <ComponentWithShopifyComponents2>Click me</ComponentWithShopifyComponents2>`;
      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-customer-account-extensions",
        extensionTarget: "customer-account.footer.render-after",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      expect(result.resultDetail).toContain(
        "No components found to validate by TypeScript.\n" +
          "\nTry and use component from Shopify Polaris components. Non-Shopify components (not validated):\n" +
          "  - ComponentWithShopifyComponents\n" +
          "  - ComponentWithShopifyComponents2",
      );
    });

    it("rejects HTML/SVG elements for POLARIS CHECKOUT EXTENSIONS", async () => {
      const code = `<div>Hello</div><clipPath>Hello</clipPath>`;
      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-checkout-extensions",
        extensionTarget: "purchase.cart-line-item.line-components.render",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
      expect(result.resultDetail).toContain(
        "Validation errors:\n" +
          "div validation failed: Property 'element': HTML element 'div' is not allowed. UI extensions must only use Shopify Polaris web components.\n" +
          "clipPath validation failed: Property 'element': SVG element 'clipPath' is not allowed. UI extensions must only use Shopify Polaris web components.",
      );
    });

    it("approves imported custom components for POLARIS CHECKOUT EXTENSIONS", async () => {
      const code = `import ComponentWithShopifyComponents from './ComponentWithShopifyComponents';
      import {ComponentWithShopifyComponents2} from './ComponentWithShopifyComponents2';
      <ComponentWithShopifyComponents>Click me</ComponentWithShopifyComponents>
      <ComponentWithShopifyComponents2>Click me</ComponentWithShopifyComponents2>`;
      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-checkout-extensions",
        extensionTarget: "purchase.cart-line-item.line-components.render",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      expect(result.resultDetail).toContain(
        "No components found to validate by TypeScript.\n" +
          "\nTry and use component from Shopify Polaris components. Non-Shopify components (not validated):\n" +
          "  - ComponentWithShopifyComponents\n" +
          "  - ComponentWithShopifyComponents2",
      );
    });

    it("rejects HTML/SVG elements for POS UI", async () => {
      const code = `<div>Hello</div><clipPath>Hello</clipPath>`;
      const result = await validateComponentCodeBlock({
        code,
        apiName: "pos-ui",
        extensionTarget: "pos.customer-details.block.render",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
      expect(result.resultDetail).toContain(
        "Validation errors:\n" +
          "div validation failed: Property 'element': HTML element 'div' is not allowed. UI extensions must only use Shopify Polaris web components.\n" +
          "clipPath validation failed: Property 'element': SVG element 'clipPath' is not allowed. UI extensions must only use Shopify Polaris web components.",
      );
    });

    it("approves imported custom components for POS UI", async () => {
      const code = `import ComponentWithShopifyComponents from './ComponentWithShopifyComponents';
      import {ComponentWithShopifyComponents2} from './ComponentWithShopifyComponents2';
      <ComponentWithShopifyComponents>Click me</ComponentWithShopifyComponents>
      <ComponentWithShopifyComponents2>Click me</ComponentWithShopifyComponents2>`;
      const result = await validateComponentCodeBlock({
        code,
        apiName: "pos-ui",
        extensionTarget: "pos.customer-details.block.render",
      });

      console.log("result", result.resultDetail);

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      expect(result.resultDetail).toContain(
        "No components found to validate by TypeScript.\n" +
          "\nTry and use component from Shopify Polaris components. Non-Shopify components (not validated):\n" +
          "  - ComponentWithShopifyComponents\n" +
          "  - ComponentWithShopifyComponents2",
      );
    });

    it("pass when shopify only components are used", async () => {
      const code = `<s-pos-block>
      <s-button
        slot="secondary-actions"
        onClick={() => shopify.action.presentModal()}
      >
        Open action
      </s-button>
      <s-text>This is a block extension</s-text>
      <s-text>Customer ID for this customer: {shopify.customer.id}</s-text>
    </s-pos-block>`;
      const result = await validateComponentCodeBlock({
        code,
        apiName: "pos-ui",
        extensionTarget: "pos.customer-details.block.render",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      expect(result.resultDetail).toContain(
        "All components validated successfully by TypeScript. Found components: s-pos-block, s-button, s-text.",
      );
    });

    it("fail when there is a mix of shopify and non-shopify components", async () => {
      const code = `<s-pos-block>
      <s-button
        slot="secondary-actions"
        onClick={() => shopify.action.presentModal()}
      >
        Open action
      </s-button>
      <s-text>This is a block extension</s-text>
      <s-text>Customer ID for this customer: {shopify.customer.id}</s-text>
    </s-pos-block>
    <button>Click me</button>`;
      const result = await validateComponentCodeBlock({
        code,
        apiName: "pos-ui",
        extensionTarget: "pos.customer-details.block.render",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
      expect(result.resultDetail).toContain(
        "Validation errors:\n" +
          "button validation failed: Property 'element': HTML element 'button' is not allowed. UI extensions must only use Shopify Polaris web components.",
      );
    });
  });

  describe("Advanced Features", () => {
    describe("performance and caching", () => {
      it("handles large code blocks", async () => {
        const largeCode = Array(50)
          .fill("<s-button>Test</s-button>")
          .join("\n");

        const result = await validateComponentCodeBlock({
          code: largeCode,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-button.",
        );
      });

      it("caches loaded packages to avoid redundant file operations", async () => {
        const code1 = "<s-button>First</s-button>";
        const code2 = "<s-text>Second</s-text>";
        const code3 = "<s-badge>Third</s-badge>";

        await validateComponentCodeBlock({
          code: code1,
          apiName: "polaris-customer-account-extensions",
          extensionTarget: "customer-account.footer.render-after",
        });

        const afterFirst = callTracker.count;

        await validateComponentCodeBlock({
          code: code2,
          apiName: "polaris-customer-account-extensions",
          extensionTarget: "customer-account.footer.render-after",
        });

        const afterSecond = callTracker.count;
        const filesLoadedSecond = afterSecond - afterFirst;

        await validateComponentCodeBlock({
          code: code3,
          apiName: "polaris-customer-account-extensions",
          extensionTarget: "customer-account.footer.render-after",
        });

        const afterThird = callTracker.count;
        const filesLoadedThird = afterThird - afterSecond;

        expect(filesLoadedSecond).toBe(0);
        expect(filesLoadedThird).toBe(0);
      });
    });
  });

  describe("POLARIS APP HOME components", () => {
    it("accepts valid alt attribute on s-avatar", async () => {
      const code = `<s-avatar alt="avatar" />`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
    });

    it("accepts valid initials attribute on s-avatar", async () => {
      const code = `<s-avatar initials="JD" alt="John Doe" />`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
    });

    it("rejects invalid saveRightSide attribute on s-avatar", async () => {
      const code = `<s-avatar saveRightSide="true" alt="avatar" />`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
    });

    it("accepts valid alt attribute on s-image", async () => {
      const code = `<s-image alt="Product image" src="https://example.com/product.jpg" />`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
    });

    it("accepts valid aspectRatio attribute on s-image", async () => {
      const code = `<s-image src="https://example.com/image.jpg" aspectRatio="16/9" alt="Featured product" />`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
    });

    it("rejects invalid randomAttribute on s-image", async () => {
      const code = `<s-image randomAttribute="value" src="https://example.com/image.jpg" alt="Product" />`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
    });

    // App Bridge custom elements (ui-modal, ui-title-bar, ui-save-bar,
    // ui-nav-menu) are declared by @shopify/app-bridge-types via a global
    // JSX augmentation. The virtual TS env runs with jsxImportSource:
    // "preact", so without the loadTypesIntoTSEnv shim that re-applies
    // the augmentation to preact's createElement.JSX namespace, these
    // elements all fail with phantom "does not exist on type
    // 'JSX.IntrinsicElements'" errors. The tests below pin the shim
    // behaviour so the regression is loud if the shim ever drops out.
    it("accepts ui-modal — App Bridge element resolves via preact JSX", async () => {
      const code = `<ui-modal id="my-modal"><p>hi</p></ui-modal>`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
    });

    it("accepts ui-title-bar — App Bridge element resolves via preact JSX", async () => {
      const code = `<ui-title-bar title="Page" />`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
    });

    it("rejects invalid variant value on ui-modal — type-checking works", async () => {
      // "banana" is not in the ui-modal variant union; with the shim in
      // place this surfaces as a real type-mismatch error rather than
      // the phantom "does not exist on JSX.IntrinsicElements".
      const code = `<ui-modal variant="banana" />`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
      expect(result.resultDetail).toMatch(/is not assignable to type/);
      expect(result.resultDetail).not.toMatch(
        /does not exist on type 'JSX.IntrinsicElements'/,
      );
    });

    it("mixes App Bridge and Polaris in one block", async () => {
      const code = `
        <ui-modal id="m">
          <s-section heading="Hello">
            <s-button variant="primary">OK</s-button>
          </s-section>
        </ui-modal>`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
    });

    // @shopify/app-bridge-react ships legacy React wrappers (TitleBar,
    // NavMenu, Modal, SaveBar) that many existing apps still import.
    // It's a public package in api-mapping.ts for polaris-app-home, so
    // its types must resolve in the virtual TS env. Without it, every
    // `import { TitleBar } from "@shopify/app-bridge-react"` produces a
    // phantom "Cannot find module" failure. These tests pin that the
    // package is loaded and its React wrappers are recognised JSX.
    it("accepts <TitleBar> from @shopify/app-bridge-react", async () => {
      const code = `
import { TitleBar } from "@shopify/app-bridge-react";
export function Page() {
  return <TitleBar title="Page" />;
}`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      // Pin classification: TitleBar must show up as a validated Shopify
      // component, not silently fall into the unvalidated/non-Shopify
      // bucket (regression guard for the app-bridge-react extractor in
      // extractShopifyComponents.ts).
      expect(result.validatedComponents).toContain("TitleBar");
    });

    it("accepts <NavMenu> from @shopify/app-bridge-react", async () => {
      const code = `
import { NavMenu } from "@shopify/app-bridge-react";
export function Nav() {
  return (
    <NavMenu>
      <a href="/home" rel="home">Home</a>
    </NavMenu>
  );
}`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      expect(result.validatedComponents).toContain("NavMenu");
    });
  });

  describe("Full HTML Page Validation", () => {
    it("validates Shopify components within a complete HTML page structure", async () => {
      const code = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App Home Page</title>
</head>
<body>
  <header>
    <s-text>Welcome to my app</s-text>
  </header>
  <main>
    <s-page heading="Dashboard">
      <s-section>
        <s-button>Click me</s-button>
        <s-badge>New</s-badge>
      </s-section>
    </s-page>
  </main>
  <footer>
    <s-text>Footer content</s-text>
  </footer>
</body>
</html>
      `;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      expect(result.resultDetail).toContain("s-text");
      expect(result.resultDetail).toContain("s-page");
      expect(result.resultDetail).toContain("s-section");
      expect(result.resultDetail).toContain("s-button");
      expect(result.resultDetail).toContain("s-badge");
      expect(result.resultDetail).toContain(
        "Try and use component from Shopify Polaris components. Non-Shopify components (not validated)",
      );
      expect(result.resultDetail).toContain("header");
      expect(result.resultDetail).toContain("main");
      expect(result.resultDetail).toContain("footer");
    });

    it("detects invalid props in Shopify components within full HTML page", async () => {
      const code = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
</head>
<body>
  <div class="container">
    <s-button invalidProp="test">Submit</s-button>
    <s-text wrongAttribute="value">Content</s-text>
  </div>
</body>
</html>
      `;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
      expect(result.resultDetail).toContain("Validation errors:");
      expect(result.resultDetail).toContain("s-button validation failed");
      expect(result.resultDetail).toContain("invalidProp");
      expect(result.resultDetail).toContain("s-text validation failed");
      expect(result.resultDetail).toContain("wrongAttribute");
    });

    it("validates deeply nested Shopify components in complex HTML structure", async () => {
      const code = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Complex Page</title>
  <style>
    .container { width: 100%; }
  </style>
</head>
<body>
  <header>
    <nav>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
  </header>
  <main>
    <article>
      <section>
        <s-page heading="Product Management">
          <s-section>
            <s-text-field label="Product Name"></s-text-field>
            <s-text-area label="Description"></s-text-area>
          </s-section>
          <s-section heading="Pricing" slot="aside">
            <s-banner tone="info" heading="Pricing Info">
              Set your product prices here
            </s-banner>
            <s-select>
              <s-option value="usd">USD</s-option>
              <s-option value="eur">EUR</s-option>
            </s-select>
          </s-section>
        </s-page>
      </section>
    </article>
  </main>
  <footer>
    <div>
      <s-text>© 2025 My Company</s-text>
    </div>
  </footer>
</body>
</html>
      `;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      expect(result.resultDetail).toContain(
        "All components validated successfully by TypeScript",
      );
      expect(result.resultDetail).toContain("s-page");
      expect(result.resultDetail).toContain("s-section");
      expect(result.resultDetail).toContain("s-text-field");
      expect(result.resultDetail).toContain("s-text-area");
      expect(result.resultDetail).toContain("s-banner");
      expect(result.resultDetail).toContain("s-select");
      expect(result.resultDetail).toContain("s-option");
      expect(result.resultDetail).toContain("s-text");
    });

    it("handles full HTML page with script tags and inline event handlers", async () => {
      const code = `
<!DOCTYPE html>
<html>
<head>
  <title>Interactive Page</title>
  <script>
    const handleButtonClick = () => {
      console.log('Button clicked');
    };
  </script>
</head>
<body>
  <div>
    <s-button onClick={(event) => { console.log('Clicked', event); }}>Click me</s-button>
    <s-text>Some content</s-text>
  </div>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      console.log('Page loaded');
    });
  </script>
</body>
</html>
      `;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      expect(result.resultDetail).toContain("s-button");
      expect(result.resultDetail).toContain("s-text");
      expect(result.resultDetail).toContain(
        "Try and use component from Shopify Polaris components. Non-Shopify components (not validated)",
      );
      expect(result.resultDetail).toContain("script");
    });

    it("validates full HTML page with mixed valid and invalid Shopify components", async () => {
      const code = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Mixed Page</title>
</head>
<body>
  <header>
    <h1>My Application</h1>
    <s-text>Valid component</s-text>
  </header>
  <main>
    <s-button invalidProp="test">Invalid Button</s-button>
    <s-badge>Valid Badge</s-badge>
    <s-page wrongAttribute="value">Invalid Page</s-page>
  </main>
</body>
</html>
      `;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
      expect(result.resultDetail).toContain("Validation errors:");
      expect(result.resultDetail).toContain("s-button validation failed");
      expect(result.resultDetail).toContain("invalidProp");
      expect(result.resultDetail).toContain("s-page validation failed");
      expect(result.resultDetail).toContain("wrongAttribute");
      expect(result.resultDetail).toContain(
        "Try and use component from Shopify Polaris components. Non-Shopify components (not validated)",
      );
    });

    it("handles full HTML page with only standard HTML elements", async () => {
      const code = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Standard HTML Page</title>
</head>
<body>
  <header>
    <h1>My Website</h1>
    <nav>
      <ul>
        <li><a href="/">Home</a></li>
      </ul>
    </nav>
  </header>
  <main>
    <article>
      <h2>Article Title</h2>
      <p>Article content goes here.</p>
    </article>
  </main>
  <footer>
    <p>Footer content</p>
  </footer>
</body>
</html>
      `;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      expect(result.resultDetail).toStrictEqual(
        "No components found to validate by TypeScript.\n\n" +
          "Try and use component from Shopify Polaris components. Non-Shopify components (not validated):\n" +
          "  - header\n" +
          "  - h1\n" +
          "  - nav\n" +
          "  - ul\n" +
          "  - li\n" +
          "  - a\n" +
          "  - main\n" +
          "  - article\n" +
          "  - h2\n" +
          "  - p\n" +
          "  - footer\n" +
          "  - p",
      );
    });
  });

  describe("JavaScript API Validation (App Home)", () => {
    describe("basic API validation", () => {
      it("detects invalid properties on shopify global", async () => {
        const code = `const invalid = shopify.nonExistentProperty();`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toContain("nonExistentProperty");
        expect(result.resultDetail).toContain("ShopifyGlobal");
      });

      it("validates both components and API calls together", async () => {
        const code = `
function MyComponent() {
  shopify.toast.show("Hello");
  
  return (
    <>
      <s-button>Click me</s-button>
      <s-text>Some text</s-text>
    </>
  );
}`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
        expect(result.resultDetail).toStrictEqual(
          "All components validated successfully by TypeScript. Found components: s-button, s-text.",
        );
      });
    });

    describe("toast API", () => {
      it("detects invalid method on toast API", async () => {
        const code = `shopify.toast.display("Hello");`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toContain("display");
        expect(result.resultDetail).toContain("ToastApi");
      });
    });

    describe("Loading APIs", () => {
      it("true loading value", async () => {
        const code = `shopify.loading(true);`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      });

      it("wrong loading value", async () => {
        const code = `shopify.loading("test");`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toContain(
          "Validation errors:\nArgument of type 'string' is not assignable to parameter of type 'boolean'.",
        );
      });
    });

    describe("config APIs", () => {
      it("detects invalid properties on config", async () => {
        const code = `const invalid = shopify.config.nonExistentProperty;`;

        const result = await validateComponentCodeBlock({
          code,
          apiName: "polaris-app-home",
        });

        expect(result.result).toStrictEqual(ValidationResult.FAILED);
        expect(result.resultDetail).toContain("nonExistentProperty");
        expect(result.resultDetail).toContain("AppBridgeConfig");
      });
    });
  });

  describe("Non-Shopify generic error suppression", () => {
    it("suppresses .trim() on union type error", async () => {
      const code = `
function MyComponent() {
  const value: string | number | boolean = "hello";
  const trimmed = value.trim();
  return <s-button>Click</s-button>;
}`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.SUCCESS);
      expect(result.resultDetail).not.toContain("trim");
    });

    it("suppresses unknown type property access errors", async () => {
      const code = `
function MyComponent() {
  const response: unknown = JSON.parse("{}");
  const name = response.name;
  return <s-text>{name}</s-text>;
}`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      // "Object is of type 'unknown'" should be suppressed
      expect(result.resultDetail).not.toContain("Object is of type");
    });

    it("still catches Shopify API errors on shopify global", async () => {
      const code = `shopify.toast.display("Hello");`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
      expect(result.resultDetail).toContain("display");
      expect(result.resultDetail).toContain("ToastApi");
    });

    it("still catches invalid component props", async () => {
      const code = `<s-button invalidProp="bad">Click</s-button>`;

      const result = await validateComponentCodeBlock({
        code,
        apiName: "polaris-app-home",
      });

      expect(result.result).toStrictEqual(ValidationResult.FAILED);
      expect(result.resultDetail).toContain("invalidProp");
    });
  });

  describe("a button across UI APIs and versions", () => {
    // Proves version-aware type loading end-to-end: each row selects a
    // different `(package, version)` from src/data/types/, so the button
    // component must resolve against the *right* type set.
    //
    // 2025-10+ exposes buttons as the `<s-button>` web component.
    // 2025-07 predates web components — buttons were React-style `<Button>`
    // via Remote DOM, so we expect that era to *reject* `<s-button>`
    // (which proves the older types were loaded, not the modern ones).
    it.each([
      // unversioned — polaris-app-home uses polaris-types web components
      {
        api: "polaris-app-home",
        version: undefined,
        target: undefined,
        expect: "success",
      },
      // versioned UI extensions, web-component era
      ...["2025-10", "2026-01"].map((version) => ({
        api: "polaris-admin-extensions",
        version,
        target: "admin.product-details.block.render",
        expect: "success" as const,
      })),
      ...["2025-10", "2026-01", "2026-04"].map((version) => ({
        api: "polaris-checkout-extensions",
        version,
        target: "purchase.cart-line-item.line-components.render",
        expect: "success" as const,
      })),
      ...["2025-10", "2026-01", "2026-04"].map((version) => ({
        api: "polaris-customer-account-extensions",
        version,
        target: "customer-account.footer.render-after",
        expect: "success" as const,
      })),
      ...["2025-10", "2026-01", "2026-04"].map((version) => ({
        api: "pos-ui",
        version,
        target: "pos.cart.line-item-details.action.render",
        expect: "success" as const,
      })),
      // versioned UI extensions, React/Remote-DOM era (2025-07).
      // The validator should load the legacy types — proving this by
      // asserting <s-button> is *unknown* there.
      ...[
        {
          api: "polaris-admin-extensions",
          target: "admin.product-details.block.render",
        },
        {
          api: "polaris-checkout-extensions",
          target: "purchase.cart-line-item.line-components.render",
        },
        {
          api: "polaris-customer-account-extensions",
          target: "customer-account.footer.render-after",
        },
        {
          api: "pos-ui",
          target: "pos.cart.line-item-details.action.render",
        },
      ].map((row) => ({
        ...row,
        version: "2025-07",
        expect: "failed" as const,
      })),
    ])(
      "<s-button> on $api@$version → $expect",
      async ({ api, version, target, expect: expected }) => {
        const result = await validateComponentCodeBlock({
          code: `<s-button>Click</s-button>`,
          apiName: api as any,
          version,
          extensionTarget: target,
        });

        // The asset tree should always be reachable — a missing-dependency
        // error would mean version routing or the `(pkg, version)` lookup
        // is broken.
        expect(result.resultDetail).not.toContain(
          "Missing required dev dependencies",
        );

        if (expected === "success") {
          expect(result.result).toBe(ValidationResult.SUCCESS);
          expect(result.resultDetail).toContain("s-button");
        } else {
          expect(result.result).toBe(ValidationResult.FAILED);
        }
      },
      30000,
    );
  });

  describe("@shopify/ui-extensions-react validates React-era component props", () => {
    it.each([
      {
        api: "polaris-checkout-extensions" as const,
        importPath: "@shopify/ui-extensions-react/checkout",
        target: "purchase.checkout.block.render",
      },
      {
        api: "polaris-customer-account-extensions" as const,
        importPath: "@shopify/ui-extensions-react/customer-account",
        target: "customer-account.order-status.block.render",
      },
    ])(
      "rejects invalid shared checkout Banner props for $api",
      async ({ api, importPath, target }) => {
        const result = await validateComponentCodeBlock({
          code: `
import {reactExtension, Banner, Button} from "${importPath}";

export default reactExtension("${target}", () => (
  <Banner tone="not-a-real-tone" obviouslyWrongProp="boom">
    <Button>Save</Button>
  </Banner>
));`,
          apiName: api,
          version: "2025-07",
          extensionTarget: target,
        });

        expect(result.result).toBe(ValidationResult.FAILED);
        expect(result.resultDetail).toContain("Banner validation failed");
        expect(result.resultDetail).toContain("Property 'tone'");
      },
      30000,
    );
  });

  describe("@shopify/ui-extensions-react is scoped to the React era", () => {
    // Regression: api-mapping.ts tags @shopify/ui-extensions-react with
    // `versions: ["2025-07"]` because the React bindings predate the
    // web-component migration. Without that scoping, the indexer wrote
    // React@2025.7.4 into every supported version slot, so a snippet
    // importing from `@shopify/ui-extensions-react/admin` validated cleanly
    // against web-component-era versions where React imports aren't a
    // supported authoring style. Here we assert the negative side directly;
    // the positive 2025-07 path is covered indirectly by the update-apis
    // plan test (it asserts React lands in the 2025-07 slot).
    const REACT_IMPORT = `
import { AdminAction, Banner, Button } from "@shopify/ui-extensions-react/admin";

export default function Extension() {
  return (
    <AdminAction>
      <Banner>Hello</Banner>
      <Button>Click</Button>
    </AdminAction>
  );
}`;

    it.each([
      {
        api: "polaris-admin-extensions" as const,
        version: "2026-04",
        target: "admin.product-details.block.render",
      },
      {
        api: "polaris-admin-extensions" as const,
        version: "2026-01",
        target: "admin.product-details.block.render",
      },
      {
        api: "polaris-admin-extensions" as const,
        version: "2025-10",
        target: "admin.product-details.block.render",
      },
      {
        api: "polaris-checkout-extensions" as const,
        version: "2026-04",
        target: "purchase.cart-line-item.line-components.render",
      },
    ])(
      "rejects the React import on $api@$version (web-component era)",
      async ({ api, version, target }) => {
        const result = await validateComponentCodeBlock({
          code: REACT_IMPORT,
          apiName: api,
          version,
          extensionTarget: target,
        });

        // Strongest signal is FAILED + the React subpath named in the
        // diagnostic. If the version-scoping regresses, the React types
        // would be loaded for these versions and the import would resolve,
        // flipping this assertion.
        expect(result.result).toBe(ValidationResult.FAILED);
        expect(result.resultDetail).toContain("@shopify/ui-extensions-react");
      },
      30000,
    );
  });

  describe("HTML mode (language: 'html')", () => {
    // Polaris components are web components, so raw HTML is a legitimate syntax
    // where every attribute is a string and native globals (class/style/onclick)
    // are valid. HTML mode must accept those without weakening the real catches.
    // See issue #22917.

    it("accepts string-valued number/boolean props in HTML", async () => {
      const result = await validateComponentCodeBlock({
        code: `<s-number-field label="Qty" min="0" value="8" />`,
        apiName: "polaris-app-home",
        language: "html",
      });

      expect(result.result).toBe(ValidationResult.SUCCESS);
    });

    it("still flags string-valued number props as TSX (regression guard)", async () => {
      // Same snippet without language stays TSX behavior: min="0" is a real
      // type error in JSX. Proves HTML relaxation is scoped to html blocks.
      const result = await validateComponentCodeBlock({
        code: `<s-number-field label="Qty" min="0" value="8" />`,
        apiName: "polaris-app-home",
      });

      expect(result.result).toBe(ValidationResult.FAILED);
      // The string->number coercion is a real TS error in TSX mode. (The prop
      // renders as 'unknown' in the message, so match on the assignability text.)
      expect(result.resultDetail).toContain(
        "Type 'string' is not assignable to type 'number'",
      );
    });

    it("accepts string-valued boolean props in HTML", async () => {
      const result = await validateComponentCodeBlock({
        code: `<s-table hasNextPage="true" paginate="true" loading="false" variant="list"></s-table>`,
        apiName: "polaris-app-home",
        language: "html",
      });

      expect(result.result).toBe(ValidationResult.SUCCESS);
    });

    it("accepts native global attributes (class, id, onclick) in HTML", async () => {
      const result = await validateComponentCodeBlock({
        code: `<s-button onclick="save()" class="primary" id="save-btn">Save</s-button>`,
        apiName: "polaris-app-home",
        language: "html",
      });

      expect(result.result).toBe(ValidationResult.SUCCESS);
    });

    it("accepts the widened global set (role, tabindex, hidden, dir) in HTML", async () => {
      const result = await validateComponentCodeBlock({
        code: `<s-button role="button" tabindex="0" hidden="false" dir="ltr">Save</s-button>`,
        apiName: "polaris-app-home",
        language: "html",
      });

      expect(result.result).toBe(ValidationResult.SUCCESS);
    });

    it("still rejects bad enum values in HTML", async () => {
      const result = await validateComponentCodeBlock({
        code: `<s-badge tone="bogus">New</s-badge>`,
        apiName: "polaris-app-home",
        language: "html",
      });

      expect(result.result).toBe(ValidationResult.FAILED);
      // Enum mismatch: expected is a literal union, so HTML relaxation does not
      // suppress it. Match on the bad value and the assignability text.
      expect(result.resultDetail).toContain("bogus");
      expect(result.resultDetail).toContain("is not assignable to type");
    });

    it("still rejects unknown props in HTML (s-heading.level)", async () => {
      const result = await validateComponentCodeBlock({
        code: `<s-heading level="2">Title</s-heading>`,
        apiName: "polaris-app-home",
        language: "html",
      });

      expect(result.result).toBe(ValidationResult.FAILED);
      expect(result.resultDetail).toContain("level");
    });

    it("still rejects unknown props in HTML (s-banner.status)", async () => {
      const result = await validateComponentCodeBlock({
        code: `<s-banner status="info">Heads up</s-banner>`,
        apiName: "polaris-app-home",
        language: "html",
      });

      expect(result.result).toBe(ValidationResult.FAILED);
      expect(result.resultDetail).toContain("status");
    });

    it.each([
      {
        apiName: "polaris-admin-extensions" as const,
        extensionTarget: "admin.abandoned-checkout-details.action.render",
      },
      {
        apiName: "polaris-checkout-extensions" as const,
        extensionTarget: "purchase.checkout.block.render",
      },
      {
        apiName: "polaris-customer-account-extensions" as const,
        extensionTarget: "customer-account.order-status.block.render",
      },
      {
        apiName: "pos-ui" as const,
        extensionTarget: "pos.customer-details.block.render",
      },
    ])(
      "rejects HTML mode for UI extension API $apiName",
      async ({ apiName, extensionTarget }) => {
        const result = await validateComponentCodeBlock({
          code: `<s-button loading="false">Save</s-button>`,
          apiName,
          extensionTarget,
          language: "html",
        });

        expect(result.result).toBe(ValidationResult.FAILED);
        expect(result.resultDetail).toBe(
          "Validation failed: HTML validation mode is only supported for API 'polaris-app-home'. Other UI framework APIs must use JSX/TSX code blocks.",
        );
      },
    );

    it("keeps UI extension TSX validation strict for string-valued booleans", async () => {
      const result = await validateComponentCodeBlock({
        code: `<s-button loading="false">Save</s-button>`,
        apiName: "polaris-checkout-extensions",
        extensionTarget: "purchase.checkout.block.render",
        language: "tsx",
      });

      expect(result.result).toBe(ValidationResult.FAILED);
      expect(result.resultDetail).toContain(
        "Type 'string' is not assignable to type 'boolean'",
      );
    });
  });
});
