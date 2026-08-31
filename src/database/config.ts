
import { defineConfig, GeneratedCacheAdapter } from "@mikro-orm/core";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { EntityManager } from "@mikro-orm/sql";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEVELOPMENT = process.env.NODE_ENV === "development" || !process.argv.includes("--prod")
const metadataPath = resolve("./temp/metadata.json")
const metadataExists = existsSync(metadataPath)
const data = metadataExists && JSON.parse(readFileSync(metadataPath, "utf-8"))

const metadataProvider = DEVELOPMENT || !metadataExists ? (await import("@mikro-orm/reflection")).TsMorphMetadataProvider : undefined


export const DatabaseConfig: Parameters<typeof defineConfig<PostgreSqlDriver, EntityManager<PostgreSqlDriver>, string[]>>[0] = {

    // extensions: [SeedManager],

    entities: [
        'dist/database/entities/*.entity.js',
    ],
    // entitiesTs: [
    //     'src/database/entities/*.entity.ts',
    // ],
    migrations: {
        path: 'src/database/migrations',
    },
    driver: PostgreSqlDriver,
    metadataProvider,
    metadataCache: {
        enabled: true,
        ...DEVELOPMENT ? undefined : {
            adapter: GeneratedCacheAdapter,
            options: { data }
        },
    },
    preferTs: true,
    verbose: true,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    dbName: process.env.DB_NAME || "nitr",
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    // debug: process.env.DEBUG === "true" || process.env.DB_DEBUG === "true",
    debug: true,

    seeder: {
        path: "dist/database/seeders",
        pathTs: "src/database/seeders",
        defaultSeeder: "DatabaseSeeder",
        glob: "!(*.d).{js,ts}",
        emit: "ts",
        fileName: (className: string) => className
    }

}