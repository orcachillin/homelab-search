import { resolve } from "path"
import { defineConfig } from "vite"

export default defineConfig({
    root: resolve("./src/client/bundled/"),
    base: "/__/",
    build: {
        assetsDir: "__",
        outDir: "../../../dist/client",
        sourcemap: true,
        rolldownOptions: {
            output: {
                entryFileNames: "[name].js",
                assetFileNames: "[name].[ext]"
            }
        }
    },
    css: {
        preprocessorOptions: {
            scss: {
                silenceDeprecations: [
                    'import',
                    'mixed-decls',
                    'color-functions',
                    'global-builtin',
                ],
            },
        },
    },
})