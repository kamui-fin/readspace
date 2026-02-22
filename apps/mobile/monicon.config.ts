// @ts-nocheck
import { reactNative, clean } from "@monicon/core/plugins";
import { MoniconConfig } from "@monicon/core";
import { loadLocalCollection } from "@monicon/core/loaders";

export default {
    collections: ["solar"],
    loaders: {
        local: loadLocalCollection("assets/icons"),
    },
    plugins: [
        clean({ patterns: ["src/components/icons"] }),
        reactNative({ outputPath: "src/components/icons" }),
    ],
} satisfies MoniconConfig;