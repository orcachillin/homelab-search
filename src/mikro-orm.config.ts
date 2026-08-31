import 'dotenv/config';
import { defineConfig } from '@mikro-orm/core';
import { DatabaseConfig } from './database/config.js';

export default defineConfig(DatabaseConfig)

