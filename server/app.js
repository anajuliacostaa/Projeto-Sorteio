import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { databaseInfo, getPool } from "./db.js";
import {
  deleteSession,
  getSessionUser,
  loginUser,
  registerUser,
  resetPassword,
  updateProfile,
  usernameExists
} from "./authRepository.js";
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

function readSessionToken(request) {
  const cookie = request.headers.cookie?.split(";").map(value => value.trim())
    .find(value => value.startsWith("sorteio_session="));
  return cookie?.slice("sorteio_session=".length);
}

function setSessionCookie(response, token, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `sorteio_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAge / 1000)}${secure}`);
}

function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", "sorteio_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

app.get("/api/auth/session", async (request, response, next) => {
  try {
    response.json({ user: await getSessionUser(readSessionToken(request)) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/username", async (request, response, next) => {
  response.set("Cache-Control", "no-store");
  try {
    response.json({ exists: await usernameExists(request.query.username) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/register", async (request, response, next) => {
  try {
    const user = await registerUser(request.body);
    const session = await loginUser({ username: user.username, password: request.body.password });
    setSessionCookie(response, session.token, session.maxAge);
    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (request, response, next) => {
  try {
    const session = await loginUser(request.body);
    setSessionCookie(response, session.token, session.maxAge);
    response.json({ user: session.user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/forgot", async (request, response, next) => {
  try {
    await resetPassword(request.body);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (request, response, next) => {
  try {
    await deleteSession(readSessionToken(request));
    clearSessionCookie(response);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

async function requireSession(request, response, next) {
  try {
    request.user = await getSessionUser(readSessionToken(request));
    if (!request.user) {
      response.status(401).json({ error: "Sessão expirada. Entre novamente." });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

app.put("/api/auth/profile", requireSession, async (request, response, next) => {
  try {
    response.json({ user: await updateProfile(request.user.id, request.body) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/history", requireSession, async (request, response, next) => {
  try {
    response.json(await getHistory(request.user.id));
  } catch (error) {
    next(error);
  }
});

app.get("/api/current", requireSession, async (request, response, next) => {
  try {
    const history = await getHistory(request.user.id);
    response.json(history[0] ?? null);
  } catch (error) {
    next(error);
  }
});

app.post("/api/draw", requireSession, async (request, response, next) => {
  try {
    response.status(201).json(await saveDraw(request.body, request.user.id));
  } catch (error) {
    next(error);
  }
});

app.put("/api/participants/:id/move", requireSession, async (request, response, next) => {
  try {
    const participantId = Number(request.params.id);
    response.json(await moveParticipant(participantId, request.body?.group, request.user.id));
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