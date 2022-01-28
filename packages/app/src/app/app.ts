import fs from "fs";
import toml from "toml";
import {FatalError, path} from "@shopify/support";
import { configurationFileNames} from "../constants";
import { z } from "zod";

const AppConfigurationSchema = z.object({
    name: z.string()
});

type AppConfiguration = z.infer<typeof AppConfigurationSchema>

type ScriptConfiguration = {
    name: string;
}

type Script = {
    configuration: ScriptConfiguration
    directory: string
}

type UIExtensionConfiguration = {
    name: string;
}

type UIExtension = {
    configuration: UIExtensionConfiguration;
    directory: string;
}

type App = {
    directory: string;
    configuration: AppConfiguration
    scripts: Script[]
    uiExtensions: UIExtension[]
}

export async function load(directory: string): Promise<App> {
    if (!fs.existsSync(directory)) {
        throw new FatalError(`Couldn't find directory ${directory}`)
    }
    const appConfigurationPath = path.join(directory, configurationFileNames.app);
    if (!fs.existsSync(appConfigurationPath)) {
        throw new FatalError(`Couldn't find the app configuration file at ${appConfigurationPath}`)
    }
    const appConfigurationContent = fs.readFileSync(appConfigurationPath, "utf-8");
    const appConfigurationObject = toml.parse(appConfigurationContent);
    const appConfiguration = AppConfigurationSchema.parse(appConfigurationObject);


    return {
        directory: directory,
        configuration: appConfiguration,
        scripts: [],
        uiExtensions: []
    }
}
