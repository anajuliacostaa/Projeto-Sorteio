import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { databaseInfo, getPool } from "./db.js";
import { getHistory, moveParticipant, saveDraw } from "./drawRepository.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDirectory = path.resolve(currentDirectory, "../dist/client");
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (request, response, next) => {
  try {
    await getPool();
    response.json({ ok: true, ...databaseInfo() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/history", async (request, response, next) => {
  try {
    response.json(await getHistory());
  } catch (error) {
    next(error);
  }
});

app.get("/api/current", async (request, response, next) => {
  try {
    const history = await getHistory();
    response.json(history[0] ?? null);
  } catch (error) {
    next(error);
  }
});

app.post("/api/draw", async (request, response, next) => {
  try {
    response.status(201).json(await saveDraw(request.body));
  } catch (error) {
    next(error);
  }
});

app.put("/api/participants/:id/move", async (request, response, next) => {
  try {
    const participantId = Number(request.params.id);
    response.json(await moveParticipant(participantId, request.body?.group));
  } catch (error) {
    next(error);
  }
});

app.use("/api", (request, response) => {
  response.status(404).json({ error: "Rota não encontrada." });
});

app.use(express.static(clientDirectory));

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  console.error(`[API] ${error.message}`);
  const status = error.statusCode || (error.type === "entity.parse.failed" ? 400 : 500);
  response.status(status).json({ error: status === 500 ? "Não foi possível concluir a operação." : error.message });
});

export default app;