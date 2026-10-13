import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getPool, sql } from "./db.js";

const scrypt = promisify(scryptCallback);
const sessionDuration = 7 * 24 * 60 * 60 * 1000;

function invalid(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function normalizeUsername(value) {
  if (typeof value !== "string") throw invalid("Informe um nome de usuário.");
  const username = value.trim();
  if (!username || username.length > 100) throw invalid("O nome de usuário deve ter até 100 caracteres.");
  return username;
}

function normalizeSecret(value, label) {
  if (typeof value !== "string" || !value.length || value.length > 256) {
    throw invalid(`Informe ${label} com até 256 caracteres.`);
  }
  return value;
}

async function hashSecret(secret, salt = randomBytes(16).toString("hex")) {
  const hash = await scrypt(secret, salt, 64);
  return { hash: hash.toString("hex"), salt };
}

async function verifySecret(secret, salt, storedHash) {
  const actual = await hashSecret(secret, salt);
  const expectedBuffer = Buffer.from(storedHash, "hex");
  const actualBuffer = Buffer.from(actual.hash, "hex");
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function publicUser(row) {
  return { id: Number(row.ID), username: row.NomeUsuario };
}

export async function usernameExists(value) {
  const username = normalizeUsername(value);
  const pool = await getPool();
  const result = await pool.request()
    .input("username", sql.NVarChar(100), username)
    .query("SELECT TOP 1 ID FROM dbo.Usuarios WHERE NomeUsuario = @username;");
  return result.recordset.length > 0;
}

export async function registerUser(body) {
  const username = normalizeUsername(body?.username);
  const password = normalizeSecret(body?.password, "uma senha");
  const keyword = normalizeSecret(body?.keyword, "uma palavra-chave");
  if (password !== body?.confirmPassword) throw invalid("As senhas não coincidem.");

  const pool = await getPool();
  const passwordFields = await hashSecret(password);
  const keywordFields = await hashSecret(keyword);
  try {
    const result = await pool.request()
      .input("username", sql.NVarChar(100), username)
      .input("passwordHash", sql.Char(128), passwordFields.hash)
      .input("passwordSalt", sql.Char(32), passwordFields.salt)
      .input("keywordHash", sql.Char(128), keywordFields.hash)
      .input("keywordSalt", sql.Char(32), keywordFields.salt)
      .query(`
        INSERT dbo.Usuarios (NomeUsuario, SenhaHash, SenhaSalt, PalavraChaveHash, PalavraChaveSalt)
        OUTPUT INSERTED.ID, INSERTED.NomeUsuario
        VALUES (@username, @passwordHash, @passwordSalt, @keywordHash, @keywordSalt);
      `);
    return publicUser(result.recordset[0]);
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) throw invalid("Usuário já cadastrado.", 409);
    throw error;
  }
}

async function findUser(username) {
  const pool = await getPool();
  const result = await pool.request()
    .input("username", sql.NVarChar(100), username)
    .query(`
      SELECT ID, NomeUsuario, SenhaHash, SenhaSalt, PalavraChaveHash, PalavraChaveSalt
      FROM dbo.Usuarios WHERE NomeUsuario = @username;
    `);
  return result.recordset[0];
}

async function replacePassword(userId, password) {
  const fields = await hashSecret(password);
  const pool = await getPool();
  await pool.request()
    .input("id", sql.Int, userId)
    .input("hash", sql.Char(128), fields.hash)
    .input("salt", sql.Char(32), fields.salt)
    .query("UPDATE dbo.Usuarios SET SenhaHash = @hash, SenhaSalt = @salt WHERE ID = @id;");
}

export async function loginUser(body) {
  const username = normalizeUsername(body?.username);
  const password = normalizeSecret(body?.password, "uma senha");
  const user = await findUser(username);
  if (!user) throw invalid("Usuário não cadastrado.", 401);
  if (!await verifySecret(password, user.SenhaSalt, user.SenhaHash)) throw invalid("Senha incorreta.", 401);

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + sessionDuration);
  const pool = await getPool();
  await pool.request()
    .input("tokenHash", sql.Char(64), tokenHash)
    .input("userId", sql.Int, user.ID)
    .input("expiresAt", sql.DateTime2, expiresAt)
    .query("INSERT dbo.Sessoes (TokenHash, UsuarioID, ExpiraEm) VALUES (@tokenHash, @userId, @expiresAt);");
  return { user: publicUser(user), token, maxAge: sessionDuration };
}

export async function getSessionUser(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const pool = await getPool();
  const result = await pool.request()
    .input("tokenHash", sql.Char(64), tokenHash)
    .query(`
      SELECT usuario.ID, usuario.NomeUsuario
      FROM dbo.Sessoes AS sessao
      INNER JOIN dbo.Usuarios AS usuario ON usuario.ID = sessao.UsuarioID
      WHERE sessao.TokenHash = @tokenHash AND sessao.ExpiraEm > SYSDATETIME();
    `);
  return result.recordset[0] ? publicUser(result.recordset[0]) : null;
}

export async function deleteSession(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const pool = await getPool();
  await pool.request()
    .input("tokenHash", sql.Char(64), tokenHash)
    .query("DELETE dbo.Sessoes WHERE TokenHash = @tokenHash;");
}

export async function resetPassword(body) {
  const username = normalizeUsername(body?.username);
  const keyword = normalizeSecret(body?.keyword, "uma palavra-chave");
  const password = normalizeSecret(body?.password, "uma senha");
  if (password !== body?.confirmPassword) throw invalid("As senhas não coincidem.");
  const user = await findUser(username);
  if (!user) throw invalid("Usuário não cadastrado.", 404);
  if (!await verifySecret(keyword, user.PalavraChaveSalt, user.PalavraChaveHash)) {
    throw invalid("Palavra-chave incorreta.", 401);
  }
  await replacePassword(user.ID, password);
}

export async function updateProfile(userId, body) {
  const username = normalizeUsername(body?.username);
  const pool = await getPool();
  const fields = { username };
  let query = "UPDATE dbo.Usuarios SET NomeUsuario = @username";

  if (body?.password) {
    const currentPassword = normalizeSecret(body.currentPassword, "a senha atual");
    const userResult = await pool.request()
      .input("id", sql.Int, userId)
      .query("SELECT SenhaHash, SenhaSalt FROM dbo.Usuarios WHERE ID = @id;");
    const user = userResult.recordset[0];
    if (!user || !await verifySecret(currentPassword, user.SenhaSalt, user.SenhaHash)) {
      throw invalid("Senha atual incorreta.", 401);
    }
    fields.password = await hashSecret(normalizeSecret(body.password, "uma nova senha"));
    query += ", SenhaHash = @passwordHash, SenhaSalt = @passwordSalt";
  }

  query += " OUTPUT INSERTED.ID, INSERTED.NomeUsuario WHERE ID = @id;";
  try {
    const request = pool.request().input("id", sql.Int, userId).input("username", sql.NVarChar(100), fields.username);
    if (fields.password) {
      request.input("passwordHash", sql.Char(128), fields.password.hash);
      request.input("passwordSalt", sql.Char(32), fields.password.salt);
    }
    const result = await request.query(query);
    if (!result.recordset[0]) throw invalid("Usuário não encontrado.", 404);
    return publicUser(result.recordset[0]);
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) throw invalid("Usuário já cadastrado.", 409);
    throw error;
  }
}