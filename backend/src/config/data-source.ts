import 'dotenv/config';
import { DataSource } from 'typeorm';
import { entities } from '../entities/index.js';
import { buildDataSourceOptions } from './database.config.js';

const migrationGlob = import.meta.url.includes('/dist/') ? 'dist/migrations/*.js' : 'src/migrations/*.ts';

export const AppDataSource = new DataSource(
  buildDataSourceOptions(
    {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'eventia',
      password: process.env.DB_PASSWORD ?? 'eventia',
      database: process.env.DB_DATABASE ?? 'eventia',
    },
    entities,
    [migrationGlob],
  ),
);