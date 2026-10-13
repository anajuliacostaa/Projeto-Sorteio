import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sql = require("mssql/msnodesqlv8");

const config = {
  server: process.env.DB_SERVER || "wk-245",
  database: process.env.DB_NAME || "SorteioDB",
  driver: process.env.DB_DRIVER || "ODBC Driver 18 for SQL Server",
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
    encrypt: false,
    useUTC: false
  },
  pool: {
    max: 8,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;

export function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect();
    poolPromise.catch(() => {
      poolPromise = undefined;
    });
  }
  return poolPromise;
}

export function databaseInfo() {
  return { server: config.server, database: config.database };
}

export { sql };