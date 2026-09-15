import type { DataSourceOptions, EntitySchema, MixedList } from 'typeorm';

export interface DatabaseEnv {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export const buildDataSourceOptions = (
  env: DatabaseEnv,
  entities: MixedList<EntitySchema | Function | string> = [],
  migrations: MixedList<Function | string> = [],
): DataSourceOptions => ({
  type: 'postgres',
  host: env.host,
  port: env.port,
  username: env.username,
  password: env.password,
  database: env.database,
  entities,
  migrations,
  synchronize: false,
});