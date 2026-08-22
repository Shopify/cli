import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ValidationResult } from "../types/index.js";
import {
  type ComponentValidation,
  extractComponentValidations,
  extractUserImportedComponents,
  formatValidationResponse,
  getComponentErrors,
  isHtmlGlobalAttribute,
  isHtmlStringCoercion,
  isStandardHTMLElement,
  parseDiagnostic,
} from "./extractComponentValidations";

describe("componentValidation", () => {
  describe("isStandardHTMLElement", () => {
    it("identifies standard HTML elements", () => {
      expect(isStandardHTMLElement("div")).toStrictEqual(true);
      expect(isStandardHTMLElement("span")).toStrictEqual(true);
      expect(isStandardHTMLElement("button")).toStrictEqual(true);
      expect(isStandardHTMLElement("input")).toStrictEqual(true);
      expect(isStandardHTMLElement("form")).toStrictEqual(true);
      expect(isStandardHTMLElement("a")).toStrictEqual(true);
    });

    it("rejects non-standard elements", () => {
      expect(isStandardHTMLElement("CustomComponent")).toStrictEqual(false);
      expect(isStandardHTMLElement("MyButton")).toStrictEqual(false);
      expect(isStandardHTMLElement("shopify-button")).toStrictEqual(false);
    });

    it("handles all HTML5 elements", () => {
      expect(isStandardHTMLElement("article")).toStrictEqual(true);
      expect(isStandardHTMLElement("section")).toStrictEqual(true);
      expect(isStandardHTMLElement("nav")).toStrictEqual(true);
      expect(isStandardHTMLElement("header")).toStrictEqual(true);
      expect(isStandardHTMLElement("footer")).toStrictEqual(true);
      expect(isStandardHTMLElement("main")).toStrictEqual(true);
    });
  });

  describe("parseDiagnostic", () => {
    it("parses property does not exist error", () => {
      const diagnostic = {} as ts.Diagnostic;
      const message = "Property 'onClick' does not exist on type 'ButtonProps'";
      const result = parseDiagnostic(diagnostic, message);

      expect(result).toEqual({
        property: "onClick",
        message,
        expected: undefined,
        actual: undefined,
      });
    });

    it("parses type not assignable error with property", () => {
      const diagnostic = {} as ts.Diagnostic;
      const message =
        "Type 'string' is not assignable to type 'number'. Property 'value' is incompatible";
      const result = parseDiagnostic(diagnostic, message);

      expect(result).toEqual({
        property: "value",
        message,
        expected: "number",
        actual: "string",
      });
    });

    it("returns unknown property for unparseable messages", () => {
      const diagnostic = {} as ts.Diagnostic;
      const message = "Some other error message";
      const result = parseDiagnostic(diagnostic, message);

      expect(result).toEqual({
        property: "unknown",
        message,
        expected: undefined,
        actual: undefined,
      });
    });

    it("handles complex type names", () => {
      const diagnostic = {} as ts.Diagnostic;
      const message =
        "Type 'React.FC<Props>' is not assignable to type 'ComponentType<State>'. Property 'render' is incompatible";
      const result = parseDiagnostic(diagnostic, message);

      expect(result).toEqual({
        property: "render",
        message,
        expected: "ComponentType<State>",
        actual: "React.FC<Props>",
      });
    });
  });

  describe("getComponentErrors", () => {
    const createDiagnostic = (
      start: number,
      length: number,
      message: string,
      code: number = 2322,
    ): ts.Diagnostic => ({
      file: undefined,
      start,
      length,
      messageText: message,
      category: ts.DiagnosticCategory.Error,
      code,
    });

    // We should no longer ignore tests outside of component range, api's are outside of the component range

    it("excludes namespace errors (code 2708)", () => {
      const diagnostics: ts.Diagnostic[] = [
        createDiagnostic(
          10,
          5,
          "Cannot use namespace 'React' as a value",
          2708,
        ),
        createDiagnostic(
          10,
          5,
          "Type 'string' is not assignable to type 'number'",
          2322,
        ),
      ];

      const { errors } = getComponentErrors(5, 20, diagnostics);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toStrictEqual(
        "Type 'string' is not assignable to type 'number'",
      );
    });

    it("includes prop type errors", () => {
      const diagnostics: ts.Diagnostic[] = [
        createDiagnostic(
          10,
          5,
          "Type 'string' is not assignable to type 'number'",
          2322,
        ),
      ];

      const { errors } = getComponentErrors(5, 20, diagnostics);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toStrictEqual(
        "Type 'string' is not assignable to type 'number'",
      );
    });

    it("excludes non-Shopify module errors", () => {
      const diagnostics: ts.Diagnostic[] = [
        createDiagnostic(10, 5, "Cannot find module 'react'", 2307),
        createDiagnostic(10, 5, "Cannot find module '@shopify/polaris'", 2307),
      ];

      const { errors } = getComponentErrors(5, 20, diagnostics);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toStrictEqual(
        "Cannot find module '@shopify/polaris'",
      );
    });

    it("handles diagnostics without start or length", () => {
      const diagnostics: ts.Diagnostic[] = [
        {
          file: undefined,
          start: undefined,
          length: undefined,
          messageText: "Global error",
          category: ts.DiagnosticCategory.Error,
          code: 2322,
        },
        createDiagnostic(10, 5, "Local error", 2322),
      ];

      const { errors } = getComponentErrors(5, 20, diagnostics);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toStrictEqual("Local error");
    });

    it("handles nested diagnostic messages", () => {
      const diagnostics: ts.Diagnostic[] = [
        {
          file: undefined,
          start: 10,
          length: 5,
          messageText: {
            messageText: "Type 'string' is not assignable to type 'number'",
            category: ts.DiagnosticCategory.Error,
            code: 2322,
            next: undefined,
          },
          category: ts.DiagnosticCategory.Error,
          code: 2322,
        },
      ];

      const { errors } = getComponentErrors(5, 20, diagnostics);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toStrictEqual(
        "Type 'string' is not assignable to type 'number'",
      );
    });
  });

  describe("extractComponentValidations", () => {
    it("skips user-defined components (PascalCase, not in library)", () => {
      const code = `
const ValidationComponent = () => {
  return (
    <>
      <UserButton />
      <s-button />
      <div />
    </>
  );
};
export default ValidationComponent;`;

      const diagnostics: ts.Diagnostic[] = [];
      const shopifyWebComponents = new Set(["s-button"]);

      const { validations } = extractComponentValidations(
        code,
        diagnostics,
        shopifyWebComponents,
      );

      expect(validations).toHaveLength(3);

      const userButton = validations.find(
        (v) => v.componentName === "UserButton",
      );
      const shopifyButton = validations.find(
        (v) => v.componentName === "s-button",
      );
      const divElement = validations.find((v) => v.componentName === "div");

      // div is a standard HTML element - skipped
      expect(divElement).toBeDefined();
      expect(divElement?.skipped).toStrictEqual(true);
      expect(divElement?.valid).toStrictEqual(true);

      // UserButton is user-defined (PascalCase, not in library) - skipped
      expect(userButton).toBeDefined();
      expect(userButton?.skipped).toStrictEqual(true);
      expect(userButton?.valid).toStrictEqual(true);

      // s-button is a library web component - validated
      expect(shopifyButton).toBeDefined();
      expect(shopifyButton?.valid).toStrictEqual(true);
      expect(shopifyButton?.errors).toStrictEqual([]);
      expect(shopifyButton?.skipped).toBeUndefined();
    });

    it("distinguishes library web components from user-defined components", () => {
      const code = `
const Component = () => {
  return (
    <>
      <MyCustomComponent />
      <s-text />
      <s-custom-user-element />
    </>
  );
};`;

      const diagnostics: ts.Diagnostic[] = [];
      const shopifyWebComponents = new Set(["s-text"]);

      const { validations } = extractComponentValidations(
        code,
        diagnostics,
        shopifyWebComponents,
      );

      const myCustom = validations.find(
        (v) => v.componentName === "MyCustomComponent",
      );
      const sText = validations.find((v) => v.componentName === "s-text");
      const sCustomUser = validations.find(
        (v) => v.componentName === "s-custom-user-element",
      );

      // MyCustomComponent is user-defined (PascalCase) - skipped
      expect(myCustom).toBeDefined();
      expect(myCustom?.skipped).toStrictEqual(true);
      expect(myCustom?.valid).toStrictEqual(true);

      // s-text is a library web component - validated
      expect(sText).toBeDefined();
      expect(sText?.valid).toStrictEqual(true);
      expect(sText?.skipped).toBeUndefined();

      // s-custom-user-element is a web component but not in library - skipped as user-defined
      expect(sCustomUser).toBeDefined();
      expect(sCustomUser?.skipped).toStrictEqual(true);
      expect(sCustomUser?.valid).toStrictEqual(true);
    });

    it("extracts JSX elements from code", () => {
      const code = `
        const Component = () => {
          return (
            <div>
              <Button>Click</Button>
              <CustomComponent />
            </div>
          );
        };
      `;
      const diagnostics: ts.Diagnostic[] = [];
      const shopifyWebComponents = new Set<string>();

      const { validations } = extractComponentValidations(
        code,
        diagnostics,
        shopifyWebComponents,
      );

      const componentNames = validations.map((v) => v.componentName);
      expect(componentNames).toStrictEqual([
        "div",
        "Button",
        "CustomComponent",
      ]);
    });

    it("marks HTML elements as skipped", () => {
      const code = `<div><span>Text</span></div>`;
      const diagnostics: ts.Diagnostic[] = [];
      const shopifyWebComponents = new Set<string>();

      const { validations } = extractComponentValidations(
        code,
        diagnostics,
        shopifyWebComponents,
      );

      expect(validations).toStrictEqual([
        {
          componentName: "div",
          valid: true,
          errors: [],
          skipped: true,
        },
        {
          componentName: "span",
          valid: true,
          errors: [],
          skipped: true,
        },
      ]);
    });

    it("validates library web components with errors", () => {
      const code = `<s-button invalidProp="value" />`;
      const diagnostics: ts.Diagnostic[] = [
        {
          file: undefined,
          start: 10,
          length: 11,
          messageText: "Type 'string' is not assignable to type 'number'",
          category: ts.DiagnosticCategory.Error,
          code: 2322,
        },
      ];
      const shopifyWebComponents = new Set(["s-button"]);

      const { validations } = extractComponentValidations(
        code,
        diagnostics,
        shopifyWebComponents,
      );

      expect(validations).toHaveLength(1);
      expect(validations[0].componentName).toStrictEqual("s-button");
      expect(validations[0].valid).toStrictEqual(false);
      expect(validations[0].errors).toHaveLength(1);
    });

    it("skips user-defined components even with errors", () => {
      const code = `<UserButton invalidProp="value" />`;
      const diagnostics: ts.Diagnostic[] = [
        {
          file: undefined,
          start: 12,
          length: 11,
          messageText: "Type 'string' is not assignable to type 'number'",
          category: ts.DiagnosticCategory.Error,
          code: 2322,
        },
      ];
      const shopifyWebComponents = new Set<string>();

      const { validations } = extractComponentValidations(
        code,
        diagnostics,
        shopifyWebComponents,
      );

      expect(validations).toStrictEqual([
        {
          componentName: "UserButton",
          valid: true,
          errors: [],
          skipped: true,
        },
      ]);
    });

    it("handles self-closing and regular JSX elements", () => {
      const code = `
        <>
          <Input />
          <Button>Text</Button>
        </>
      `;
      const diagnostics: ts.Diagnostic[] = [];
      const shopifyWebComponents = new Set<string>();

      const { validations } = extractComponentValidations(
        code,
        diagnostics,
        shopifyWebComponents,
      );

      const componentNames = validations.map((v) => v.componentName);
      expect(componentNames).toStrictEqual(["Input", "Button"]);
    });

    describe("strict mode (UI extensions)", () => {
      it("fails validation for HTML elements in strict mode", () => {
        const code = `
const Component = () => {
  return (
    <>
      <div>Not allowed</div>
      <s-button />
    </>
  );
};`;
        const diagnostics: ts.Diagnostic[] = [];
        const shopifyWebComponents = new Set(["s-button"]);

        const { validations } = extractComponentValidations(
          code,
          diagnostics,
          shopifyWebComponents,
          { enforceShopifyOnlyComponents: true },
        );

        const divElement = validations.find((v) => v.componentName === "div");
        const shopifyButton = validations.find(
          (v) => v.componentName === "s-button",
        );

        // div should fail in strict mode
        expect(divElement).toBeDefined();
        expect(divElement?.valid).toStrictEqual(false);
        expect(divElement?.errors).toHaveLength(1);
        expect(divElement?.errors[0].message).toContain(
          "HTML element 'div' is not allowed",
        );

        // s-button is a Shopify component - validated normally
        expect(shopifyButton).toBeDefined();
        expect(shopifyButton?.valid).toStrictEqual(true);
      });

      it("fails validation for SVG elements in strict mode", () => {
        // Note: <svg> is also an HTML element, so it gets caught as HTML first
        // Using SVG-only elements like <circle>, <rect>, <polygon> for this test
        const code = `<circle /><rect /><polygon />`;
        const diagnostics: ts.Diagnostic[] = [];
        const shopifyWebComponents = new Set<string>();

        const { validations } = extractComponentValidations(
          code,
          diagnostics,
          shopifyWebComponents,
          { enforceShopifyOnlyComponents: true },
        );

        const circleElement = validations.find(
          (v) => v.componentName === "circle",
        );
        const rectElement = validations.find((v) => v.componentName === "rect");
        const polygonElement = validations.find(
          (v) => v.componentName === "polygon",
        );

        expect(circleElement).toBeDefined();
        expect(circleElement?.valid).toStrictEqual(false);
        expect(circleElement?.errors[0].message).toContain(
          "SVG element 'circle' is not allowed",
        );

        expect(rectElement).toBeDefined();
        expect(rectElement?.valid).toStrictEqual(false);
        expect(rectElement?.errors[0].message).toContain(
          "SVG element 'rect' is not allowed",
        );

        expect(polygonElement).toBeDefined();
        expect(polygonElement?.valid).toStrictEqual(false);
        expect(polygonElement?.errors[0].message).toContain(
          "SVG element 'polygon' is not allowed",
        );
      });

      it("fails validation for non-imported custom components in strict mode", () => {
        const code = `
const Component = () => {
  return <CustomButton onClick={() => {}} />;
};`;
        const diagnostics: ts.Diagnostic[] = [];
        const shopifyWebComponents = new Set<string>();

        const { validations } = extractComponentValidations(
          code,
          diagnostics,
          shopifyWebComponents,
          { enforceShopifyOnlyComponents: true },
        );

        const customButton = validations.find(
          (v) => v.componentName === "CustomButton",
        );

        expect(customButton).toBeDefined();
        expect(customButton?.valid).toStrictEqual(false);
        expect(customButton?.errors[0].message).toContain(
          "Custom component 'CustomButton' is not allowed",
        );
        expect(customButton?.errors[0].message).toContain(
          "If this is a wrapper component, make sure to import it",
        );
      });

      it("allows user-imported components in strict mode (wrapper assumption)", () => {
        const code = `
import { MyWrapper } from './components/MyWrapper';
import CustomButton from '../shared/CustomButton';

const Component = () => {
  return (
    <>
      <MyWrapper>
        <s-text>Hello</s-text>
      </MyWrapper>
      <CustomButton />
    </>
  );
};`;
        const diagnostics: ts.Diagnostic[] = [];
        const shopifyWebComponents = new Set(["s-text"]);

        const { validations } = extractComponentValidations(
          code,
          diagnostics,
          shopifyWebComponents,
          { enforceShopifyOnlyComponents: true },
        );

        const myWrapper = validations.find(
          (v) => v.componentName === "MyWrapper",
        );
        const customButton = validations.find(
          (v) => v.componentName === "CustomButton",
        );
        const sText = validations.find((v) => v.componentName === "s-text");

        // Imported components are allowed (skipped) - assumed to be wrappers
        expect(myWrapper).toBeDefined();
        expect(myWrapper?.valid).toStrictEqual(true);
        expect(myWrapper?.skipped).toStrictEqual(true);

        expect(customButton).toBeDefined();
        expect(customButton?.valid).toStrictEqual(true);
        expect(customButton?.skipped).toStrictEqual(true);

        // Shopify components are validated normally
        expect(sText).toBeDefined();
        expect(sText?.valid).toStrictEqual(true);
        expect(sText?.skipped).toBeUndefined();
      });

      it("does not allow components imported from @shopify packages to bypass validation", () => {
        const code = `
import { Button } from '@shopify/polaris';

const Component = () => {
  return <Button>Click me</Button>;
};`;
        const diagnostics: ts.Diagnostic[] = [];
        const shopifyWebComponents = new Set<string>();

        const { validations } = extractComponentValidations(
          code,
          diagnostics,
          shopifyWebComponents,
          { enforceShopifyOnlyComponents: true },
        );

        const button = validations.find((v) => v.componentName === "Button");

        // Button from @shopify/polaris is not in the extension's shopifyWebComponents
        // and is not a user-defined import (it's from @shopify), so it should fail
        expect(button).toBeDefined();
        expect(button?.valid).toStrictEqual(false);
      });

      it("validates mixed content with some imported and some non-imported components", () => {
        const code = `
import { WrapperComponent } from './wrappers';

const Component = () => {
  return (
    <>
      <WrapperComponent>
        <s-button />
        <div>Not allowed</div>
        <UnimportedComponent />
      </WrapperComponent>
    </>
  );
};`;
        const diagnostics: ts.Diagnostic[] = [];
        const shopifyWebComponents = new Set(["s-button"]);

        const { validations } = extractComponentValidations(
          code,
          diagnostics,
          shopifyWebComponents,
          { enforceShopifyOnlyComponents: true },
        );

        const wrapper = validations.find(
          (v) => v.componentName === "WrapperComponent",
        );
        const sButton = validations.find((v) => v.componentName === "s-button");
        const div = validations.find((v) => v.componentName === "div");
        const unimported = validations.find(
          (v) => v.componentName === "UnimportedComponent",
        );

        // WrapperComponent is imported - allowed (skipped)
        expect(wrapper?.valid).toStrictEqual(true);
        expect(wrapper?.skipped).toStrictEqual(true);

        // s-button is a Shopify component - validated
        expect(sButton?.valid).toStrictEqual(true);
        expect(sButton?.skipped).toBeUndefined();

        // div is HTML - not allowed in strict mode
        expect(div?.valid).toStrictEqual(false);

        // UnimportedComponent is not imported - not allowed
        expect(unimported?.valid).toStrictEqual(false);
      });
    });
  });

  describe("extractUserImportedComponents", () => {
    function parseCode(code: string): ts.SourceFile {
      return ts.createSourceFile(
        "test.tsx",
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
    }

    it("extracts default imports", () => {
      const code = `
import MyComponent from './MyComponent';
import AnotherComponent from '../shared/AnotherComponent';
`;
      const sourceFile = parseCode(code);
      const imports = extractUserImportedComponents(sourceFile);

      expect(imports.has("MyComponent")).toStrictEqual(true);
      expect(imports.has("AnotherComponent")).toStrictEqual(true);
    });

    it("extracts named imports", () => {
      const code = `
import { Button, TextField, Card } from './components';
`;
      const sourceFile = parseCode(code);
      const imports = extractUserImportedComponents(sourceFile);

      expect(imports.has("Button")).toStrictEqual(true);
      expect(imports.has("TextField")).toStrictEqual(true);
      expect(imports.has("Card")).toStrictEqual(true);
    });

    it("extracts both default and named imports", () => {
      const code = `
import DefaultComponent, { NamedOne, NamedTwo } from './components';
`;
      const sourceFile = parseCode(code);
      const imports = extractUserImportedComponents(sourceFile);

      expect(imports.has("DefaultComponent")).toStrictEqual(true);
      expect(imports.has("NamedOne")).toStrictEqual(true);
      expect(imports.has("NamedTwo")).toStrictEqual(true);
    });

    it("excludes @shopify package imports", () => {
      const code = `
import { Button } from '@shopify/polaris';
import { useApi } from '@shopify/ui-extensions';
import MyWrapper from './MyWrapper';
`;
      const sourceFile = parseCode(code);
      const imports = extractUserImportedComponents(sourceFile);

      // @shopify imports should not be included
      expect(imports.has("Button")).toStrictEqual(false);
      expect(imports.has("useApi")).toStrictEqual(false);

      // User imports should be included
      expect(imports.has("MyWrapper")).toStrictEqual(true);
    });

    it("handles relative path imports", () => {
      const code = `
import Component1 from './Component1';
import Component2 from '../Component2';
import Component3 from '../../shared/Component3';
`;
      const sourceFile = parseCode(code);
      const imports = extractUserImportedComponents(sourceFile);

      expect(imports.has("Component1")).toStrictEqual(true);
      expect(imports.has("Component2")).toStrictEqual(true);
      expect(imports.has("Component3")).toStrictEqual(true);
    });

    it("handles absolute/node_modules imports that are not @shopify", () => {
      const code = `
import { useState } from 'react';
import lodash from 'lodash';
`;
      const sourceFile = parseCode(code);
      const imports = extractUserImportedComponents(sourceFile);

      // Non-@shopify package imports are treated as user imports
      expect(imports.has("useState")).toStrictEqual(true);
      expect(imports.has("lodash")).toStrictEqual(true);
    });

    it("returns empty set when no imports", () => {
      const code = `const Component = () => <div />;`;
      const sourceFile = parseCode(code);
      const imports = extractUserImportedComponents(sourceFile);

      expect(imports.size).toStrictEqual(0);
    });

    it("handles renamed imports", () => {
      const code = `
import { OriginalName as RenamedComponent } from './components';
`;
      const sourceFile = parseCode(code);
      const imports = extractUserImportedComponents(sourceFile);

      // The local name (RenamedComponent) should be extracted, not the original
      expect(imports.has("RenamedComponent")).toStrictEqual(true);
      expect(imports.has("OriginalName")).toStrictEqual(false);
    });
  });

  describe("formatValidationResponse", () => {
    it("returns success when all components are valid", () => {
      const validations: ComponentValidation[] = [
        {
          componentName: "Button",
          valid: true,
          errors: [],
        },
        {
          componentName: "Text",
          valid: true,
          errors: [],
        },
      ];

      const response = formatValidationResponse(validations);

      expect(response.result).toBe(ValidationResult.SUCCESS);
      expect(response.resultDetail).toStrictEqual(
        "All components validated successfully by TypeScript. Found components: Button, Text.",
      );
      expect(response.componentValidationErrors).toStrictEqual([]);
      expect(response.genericErrors).toStrictEqual([]);
      expect(response.unvalidatedComponents).toStrictEqual([]);
      expect(response.validatedComponents).toStrictEqual(["Button", "Text"]);
    });

    it("returns failure with error details", () => {
      const validations: ComponentValidation[] = [
        {
          componentName: "Button",
          valid: false,
          errors: [
            {
              property: "onClick",
              message: "Property 'onClick' does not exist",
            },
          ],
        },
      ];

      const response = formatValidationResponse(validations);

      expect(response.result).toBe(ValidationResult.FAILED);
      const expectedDetail =
        "Validation errors:\nButton validation failed: Property 'onClick': Property 'onClick' does not exist";
      expect(response.resultDetail).toStrictEqual(expectedDetail);
      expect(response.componentValidationErrors).toStrictEqual([
        {
          componentName: "Button",
          property: "onClick",
          message: "Property 'onClick' does not exist",
        },
      ]);
    });

    it("lists skipped components separately", () => {
      const validations: ComponentValidation[] = [
        {
          componentName: "Button",
          valid: true,
          errors: [],
        },
        {
          componentName: "div",
          valid: true,
          errors: [],
          skipped: true,
        },
        {
          componentName: "CustomComponent",
          valid: true,
          errors: [],
          skipped: true,
        },
      ];

      const response = formatValidationResponse(validations);

      expect(response.result).toBe(ValidationResult.SUCCESS);
      const expectedDetail =
        "All components validated successfully by TypeScript. Found components: Button.\n\nTry and use component from Shopify Polaris components. Non-Shopify components (not validated):\n  - div\n  - CustomComponent";
      expect(response.resultDetail).toStrictEqual(expectedDetail);
      expect(response.componentValidationErrors).toStrictEqual([]);
      expect(response.unvalidatedComponents).toStrictEqual([
        "div",
        "CustomComponent",
      ]);
      expect(response.validatedComponents).toStrictEqual(["Button"]);
    });

    it("handles mixed results correctly", () => {
      const validations: ComponentValidation[] = [
        {
          componentName: "Button",
          valid: true,
          errors: [],
        },
        {
          componentName: "Text",
          valid: false,
          errors: [
            {
              property: "value",
              message: "Type error",
            },
          ],
        },
        {
          componentName: "div",
          valid: true,
          errors: [],
          skipped: true,
        },
      ];

      const response = formatValidationResponse(validations);

      expect(response.result).toBe(ValidationResult.FAILED);
      const expectedDetail =
        "Validation errors:\nText validation failed: Property 'value': Type error\n\nTry and use component from Shopify Polaris components. Non-Shopify components (not validated):\n  - div";
      expect(response.resultDetail).toStrictEqual(expectedDetail);
      expect(response.componentValidationErrors).toStrictEqual([
        {
          componentName: "Text",
          property: "value",
          message: "Type error",
        },
      ]);
      expect(response.unvalidatedComponents).toStrictEqual(["div"]);
      // Failing Shopify components are NOT counted as validated.
      expect(response.validatedComponents).toStrictEqual(["Button"]);
    });

    it("handles empty validations", () => {
      const validations: ComponentValidation[] = [];

      const response = formatValidationResponse(validations);

      expect(response.result).toBe(ValidationResult.SUCCESS);
      expect(response.resultDetail).toStrictEqual(
        "No components found to validate by TypeScript.",
      );
      expect(response.componentValidationErrors).toStrictEqual([]);
      expect(response.genericErrors).toStrictEqual([]);
      expect(response.unvalidatedComponents).toStrictEqual([]);
      expect(response.validatedComponents).toStrictEqual([]);
    });

    it("includes genericErrors in response", () => {
      const validations: ComponentValidation[] = [
        {
          componentName: "Button",
          valid: true,
          errors: [],
        },
      ];
      const genericErrors = [
        { message: "Cannot find name 'foo'", code: 2304, start: 10, end: 13 },
      ];

      const response = formatValidationResponse(validations, genericErrors);

      expect(response.result).toBe(ValidationResult.FAILED);
      expect(response.genericErrors).toStrictEqual(genericErrors);
      expect(response.componentValidationErrors).toStrictEqual([]);
    });

    it("handles multiple errors per component", () => {
      const validations: ComponentValidation[] = [
        {
          componentName: "Button",
          valid: false,
          errors: [
            {
              property: "onClick",
              message: "Missing property",
            },
            {
              property: "disabled",
              message: "Invalid type",
              expected: "boolean",
              actual: "string",
            },
          ],
        },
      ];

      const response = formatValidationResponse(validations);

      expect(response.result).toBe(ValidationResult.FAILED);
      const expectedDetail =
        "Validation errors:\nButton validation failed: Property 'onClick': Missing property\nButton validation failed: Property 'disabled': Invalid type";
      expect(response.resultDetail).toStrictEqual(expectedDetail);
    });
  });

  describe("hyphenated attribute detection", () => {
    it("flags hyphenated props on Shopify components", () => {
      const code = `
const Component = () => (
  <s-grid grid-template-columns="repeat(3, 1fr)" gap="base" />
);`;

      const { validations } = extractComponentValidations(
        code,
        [],
        new Set(["s-grid"]),
      );

      const grid = validations.find((v) => v.componentName === "s-grid");
      expect(grid?.valid).toBe(false);
      expect(grid?.errors).toHaveLength(1);
      expect(grid?.errors[0].property).toBe("grid-template-columns");
      expect(grid?.errors[0].message).toContain("gridTemplateColumns");
    });

    it("allows aria-* attributes on Shopify components", () => {
      const code = `
const Component = () => (
  <s-grid aria-label="product grid" aria-hidden="true" />
);`;

      const { validations } = extractComponentValidations(
        code,
        [],
        new Set(["s-grid"]),
      );

      const grid = validations.find((v) => v.componentName === "s-grid");
      expect(grid?.valid).toBe(true);
      expect(grid?.errors).toHaveLength(0);
    });

    it("allows data-* attributes on Shopify components", () => {
      const code = `
const Component = () => (
  <s-button data-testid="submit-btn" />
);`;

      const { validations } = extractComponentValidations(
        code,
        [],
        new Set(["s-button"]),
      );

      const button = validations.find((v) => v.componentName === "s-button");
      expect(button?.valid).toBe(true);
      expect(button?.errors).toHaveLength(0);
    });

    it("does not flag camelCase props on Shopify components", () => {
      const code = `
const Component = () => (
  <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base" />
);`;

      const { validations } = extractComponentValidations(
        code,
        [],
        new Set(["s-grid"]),
      );

      const grid = validations.find((v) => v.componentName === "s-grid");
      expect(grid?.valid).toBe(true);
      expect(grid?.errors).toHaveLength(0);
    });

    it("does not flag hyphenated props on non-Shopify (skipped) elements", () => {
      const code = `
const Component = () => (
  <div data-foo="bar" grid-template-columns="1fr" />
);`;

      const { validations } = extractComponentValidations(
        code,
        [],
        new Set(["s-grid"]),
      );

      const div = validations.find((v) => v.componentName === "div");
      expect(div?.skipped).toBe(true);
      expect(div?.valid).toBe(true);
    });

    it("flags multiple hyphenated props and reports each", () => {
      const code = `
const Component = () => (
  <s-grid grid-template-columns="1fr" grid-template-rows="auto" gap="base" />
);`;

      const { validations } = extractComponentValidations(
        code,
        [],
        new Set(["s-grid"]),
      );

      const grid = validations.find((v) => v.componentName === "s-grid");
      expect(grid?.valid).toBe(false);
      expect(grid?.errors).toHaveLength(2);
      const props = grid?.errors.map((e) => e.property);
      expect(props).toContain("grid-template-columns");
      expect(props).toContain("grid-template-rows");
    });
  });

  describe("isHtmlGlobalAttribute", () => {
    it("accepts native global attributes and lowercase handlers", () => {
      for (const name of [
        "class",
        "style",
        "title",
        "id",
        "slot",
        // Widened global set
        "role",
        "hidden",
        "lang",
        "dir",
        "tabindex",
        "inert",
        "part",
        "is",
        "nonce",
        "popover",
        "contenteditable",
        "draggable",
        "spellcheck",
        "translate",
        "autocapitalize",
        "autofocus",
        "accesskey",
        "enterkeyhint",
        "inputmode",
        // Native lowercase event handlers
        "onclick",
        "onchange",
        "oninput",
      ]) {
        expect(isHtmlGlobalAttribute(name)).toBe(true);
      }
    });

    it("rejects camelCase handlers and component-specific props", () => {
      // onClick (camelCase) is a JSX handler, not native HTML — must not be
      // suppressed. headng/tone/level are real or hallucinated component props
      // that should still fail. tabIndex (camelCase) is the JSX spelling, not
      // the native `tabindex`, so it must not be globally suppressed.
      for (const name of [
        "onClick",
        "onInput",
        "headng",
        "tone",
        "value",
        "level",
        "tabIndex",
        "contentEditable",
      ]) {
        expect(isHtmlGlobalAttribute(name)).toBe(false);
      }
    });
  });

  describe("isHtmlStringCoercion", () => {
    it("suppresses string->number / string->boolean coercion", () => {
      expect(
        isHtmlStringCoercion(
          "Type 'string' is not assignable to type 'number'.",
        ),
      ).toBe(true);
      expect(
        isHtmlStringCoercion(
          "Type 'string' is not assignable to type 'boolean'.",
        ),
      ).toBe(true);
      // Optional primitive (e.g. min?: number) flattens to a union with
      // undefined and must still be suppressed.
      expect(
        isHtmlStringCoercion(
          "Type 'string' is not assignable to type 'number | undefined'.",
        ),
      ).toBe(true);
    });

    it("keeps enum (string-literal-union) mismatches and non-string sources", () => {
      // Bad enum value: expected is a literal union, not a bare primitive.
      expect(
        isHtmlStringCoercion(
          `Type '"bogus"' is not assignable to type '"auto" | "critical" | "warning"'.`,
        ),
      ).toBe(false);
      // Source isn't a plain string — a genuine non-coercion mismatch.
      expect(
        isHtmlStringCoercion(
          "Type 'number' is not assignable to type 'string'.",
        ),
      ).toBe(false);
      // Not a TYPE_NOT_ASSIGNABLE message at all.
      expect(
        isHtmlStringCoercion("Property 'foo' does not exist on type 'Bar'."),
      ).toBe(false);
    });
  });
});
