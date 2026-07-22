import { describe, expect, it } from "vitest";
import { analyze, type ComponentInstance } from "./inspect_components";

function instance(
  out: ReturnType<typeof analyze>,
  name: string,
): ComponentInstance {
  const found = out.componentInstances.find((c) => c.name === name);
  expect(found, `expected a <${name}> instance`).toBeDefined();
  return found!;
}

function prop(inst: ComponentInstance, name: string) {
  return inst.props.find((p) => p.name === name);
}

function requiredProp(inst: ComponentInstance, name: string) {
  const found = prop(inst, name);
  expect(found, `expected <${inst.name}> prop ${name}`).toBeDefined();
  return found!;
}

describe("inspect_components analyze", () => {
  it("captures function-prop kind and source", () => {
    const out = analyze(
      `<s-button onClick={() => shopify.close()}>Save</s-button>`,
    );
    const btn = instance(out, "s-button");
    expect(prop(btn, "onClick")).toEqual({
      name: "onClick",
      kind: "function",
      source: "() => shopify.close()",
    });
    expect(btn.text).toBe("Save");
  });

  it("captures string-literal prop values and sources", () => {
    const out = analyze(
      `<s-grid rowGap="base" gridTemplateColumns="1fr 1fr" />`,
    );
    const grid = instance(out, "s-grid");
    expect(prop(grid, "rowGap")).toEqual({
      name: "rowGap",
      kind: "string",
      value: "base",
      source: "base",
    });
    expect(requiredProp(grid, "gridTemplateColumns").value).toBe("1fr 1fr");
  });

  it("captures boolean-shorthand props as true", () => {
    const out = analyze(`<s-button disabled />`);
    const btn = instance(out, "s-button");
    expect(prop(btn, "disabled")).toEqual({
      name: "disabled",
      kind: "boolean",
      value: true,
      source: "true",
    });
  });

  it("collects text recursively from descendant nodes", () => {
    const out = analyze(`<s-section><s-text>hint</s-text></s-section>`);
    const section = instance(out, "s-section");
    const text = instance(out, "s-text");
    expect(text.text).toBe("hint");
    // Recursive: the container's text includes descendant text.
    expect(section.text).toBe("hint");
  });

  it("captures spread attributes separately from named props", () => {
    const out = analyze(`<s-button {...rest} variant="primary">Go</s-button>`);
    const btn = instance(out, "s-button");
    expect(btn.spreads).toEqual(["rest"]);
    expect(requiredProp(btn, "variant").value).toBe("primary");
  });

  it("collects flat elements, imports, targets, and calls", () => {
    const out = analyze(
      `import {Button} from '@shopify/polaris';\n` +
        `reactExtension('customer-account.page.render', () => <Button>Hi</Button>);`,
    );
    expect(out.elements).toContain("Button");
    expect(out.imports).toEqual([
      { from: "@shopify/polaris", names: ["Button"] },
    ]);
    expect(out.targets).toEqual(["customer-account.page.render"]);
    expect(out.calls).toContain("reactExtension");
  });
});
