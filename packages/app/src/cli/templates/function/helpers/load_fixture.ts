import fs from "fs";

export async function loadFixture(fixturePath: string) {
  try {
    const fixtureContent = await fs.promises.readFile(fixturePath, 'utf-8');
    const fixture = JSON.parse(fixtureContent);

    return {
      name: fixture.name,
      export: fixture.export,
      query: fixture.query,
      input: fixture.input,
      expectedOutput: fixture.output,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in fixture file ${fixturePath}: ${error.message}`);
    } else if (error instanceof Error) {
      throw new Error(`Failed to load fixture file ${fixturePath}: ${error.message}`);
    } else {
      throw new Error(`Unknown error loading fixture file ${fixturePath}`);
    }
  }
}
