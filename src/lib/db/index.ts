import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const client = postgres(process.env.DATABASE_URL!);
  return drizzle(client, { schema });
}

type DbType = ReturnType<typeof createDb>;

let _db: DbType | undefined;

export function getDb(): DbType {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export const db = new Proxy({} as DbType, {
  get(_, prop: string | symbol) {
    const instance = getDb();
    const value = instance[prop as keyof DbType];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
