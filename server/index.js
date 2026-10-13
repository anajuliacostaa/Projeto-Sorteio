import { spawn } from "node:child_process";
import app from "./app.js";
import { databaseInfo } from "./db.js";

const host = process.env.APP_HOST || "127.0.0.1";
const port = Number(process.env.APP_PORT || 8765);

app.listen(port, host, () => {
  const { server, database } = databaseInfo();
  console.log(`Sorteio disponível em http://${host}:${port}/ (SQL Server ${server}/${database})`);
  if (process.env.OPEN_BROWSER === "1" && process.platform === "win32") {
    const browser = spawn("cmd.exe", ["/c", "start", "", `http://${host}:${port}/`], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    browser.on("error", error => console.error(`[browser] ${error.message}`));
    browser.unref();
  }
});