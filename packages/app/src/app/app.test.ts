import {load} from "./app";
import {FatalError, path } from "@shopify/support";
import fs from "fs";
import os from "os";
import { configurationFileNames} from "../constants";

describe("load", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir()));
    })
    afterEach(() => {
        if (tmpDir) {
            //TODO: Only available from Node 14
            //TODO: Add some checks to ensure the dependencies have the license we expect.
            fs.rmSync(tmpDir, { recursive: true });
        }
    })

    it("throws an error if the directory doesn't exist", async () => {
        // Given
        const directory = "/tmp/doesnt/exist"

        // When/Then
        expect(load(directory)).rejects.toBeInstanceOf(FatalError);
    })

    it("throws an error if the configuration file doesn't exist", async () => {
        // When/Then
        expect(load(tmpDir)).rejects.toBeInstanceOf(FatalError);
    })

    it("loads the app when its configuration is valid and has no blocks", async () => {
        // Given
        const appConfiguration = `
        name = "my_app"
        `
        const appConfigurationPath = path.join(tmpDir, configurationFileNames.app);
        fs.writeFileSync(appConfigurationPath, appConfiguration)

        // When
        const app = await load(tmpDir);

        // Then
        expect(app.configuration.name).toBe("my_app");
    })
})
