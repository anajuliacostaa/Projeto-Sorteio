import { getPool, sql } from "./db.js";

function toDraw(header, participants, changes) {
  return {
    id: Number(header.ID),
    type: header.TipoSorteio,
    date: header.DataHora,
    total: header.QuantidadeParticipantes,
    participants: participants
      .filter(person => Number(person.SorteioID) === Number(header.ID))
      .map(person => ({
        id: Number(person.ID),
        name: person.Nome,
        group: person.Grupo,
        order: person.Ordem
      })),
    changes: changes
      .filter(change => Number(change.SorteioID) === Number(header.ID))
      .map(change => ({
        id: Number(change.ID),
        participantId: Number(change.ParticipanteID),
        name: change.Nome,
        from: change.GrupoOrigem,
        to: change.GrupoDestino,
        date: change.DataHora
      }))
  };
}

export async function getHistory() {
  const pool = await getPool();
  const [draws, participants, changes] = await Promise.all([
    pool.request().query(`
      SELECT ID, TipoSorteio,
        CONVERT(nvarchar(19), DataHora, 126) AS DataHora,
        QuantidadeParticipantes
      FROM dbo.Sorteios ORDER BY DataHora DESC, ID DESC;
    `),
    pool.request().query(`
      SELECT ID, SorteioID, Nome, Grupo, Ordem
      FROM dbo.SorteioParticipantes ORDER BY SorteioID DESC, Ordem;
    `),
    pool.request().query(`
      SELECT ID, SorteioID, ParticipanteID, Nome, GrupoOrigem, GrupoDestino,
        CONVERT(nvarchar(19), DataHora, 126) AS DataHora
      FROM dbo.SorteioAlteracoes ORDER BY SorteioID DESC, DataHora, ID;
    `)
  ]);

  return draws.recordset.map(header =>
    toDraw(header, participants.recordset, changes.recordset)
  );
}

export async function saveDraw(body) {
  const allowedTypes = new Set(["individual", "groups", "pairs"]);
  if (!body || !allowedTypes.has(body.type)) {
    throw Object.assign(new Error("Tipo de sorteio inválido."), { statusCode: 400 });
  }

  const people = body.participants;
  const total = Number(body.total);
  if (!Array.isArray(people) || people.length < 1 || people.length > 300) {
    throw Object.assign(new Error("A quantidade de participantes deve ficar entre 1 e 300."), { statusCode: 400 });
  }
  if (!Number.isInteger(total) || total < people.length || total > 300) {
    throw Object.assign(new Error("Quantidade total de participantes inválida."), { statusCode: 400 });
  }
  for (const [index, person] of people.entries()) {
    if (typeof person?.name !== "string" || !person.name.trim() || person.name.length > 250) {
      throw Object.assign(new Error("Cada nome deve conter de 1 a 250 caracteres."), { statusCode: 400 });
    }
    if (person.group != null && (typeof person.group !== "string" || person.group.length > 100)) {
      throw Object.assign(new Error("O nome do grupo excede 100 caracteres."), { statusCode: 400 });
    }
    if (person.order != null && !Number.isInteger(Number(person.order))) {
      throw Object.assign(new Error("Ordem do participante inválida."), { statusCode: 400 });
    }
    people[index] = { ...person, order: Number(person.order ?? index) };
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const header = await new sql.Request(transaction)
      .input("type", sql.NVarChar(20), body.type)
      .input("total", sql.Int, total)
      .query(`
        INSERT dbo.Sorteios (TipoSorteio, QuantidadeParticipantes)
        OUTPUT INSERTED.ID
        VALUES (@type, @total);
      `);
    const drawId = header.recordset[0].ID;

    for (const person of people) {
      await new sql.Request(transaction)
        .input("drawId", sql.BigInt, drawId)
        .input("name", sql.NVarChar(250), person.name.trim())
        .input("group", sql.NVarChar(100), person.group ?? null)
        .input("order", sql.Int, person.order)
        .query(`
          INSERT dbo.SorteioParticipantes (SorteioID, Nome, Grupo, Ordem)
          VALUES (@drawId, @name, @group, @order);
        `);
    }

    await transaction.commit();
    return { id: Number(drawId) };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function moveParticipant(participantId, destination) {
  if (!Number.isSafeInteger(participantId) || participantId < 1) {
    throw Object.assign(new Error("Participante não encontrado."), { statusCode: 404 });
  }
  if (typeof destination !== "string" || !destination.trim() || destination.length > 100) {
    throw Object.assign(new Error("Informe um grupo de destino válido."), { statusCode: 400 });
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const result = await new sql.Request(transaction)
      .input("id", sql.BigInt, participantId)
      .query(`
        SELECT SorteioID, Nome, Grupo
        FROM dbo.SorteioParticipantes WITH (UPDLOCK, ROWLOCK)
        WHERE ID = @id;
      `);
    const participant = result.recordset[0];
    if (!participant) {
      throw Object.assign(new Error("Participante não encontrado."), { statusCode: 404 });
    }

    if (participant.Grupo === destination) {
      await transaction.commit();
      return { moved: false };
    }

    await new sql.Request(transaction)
      .input("id", sql.BigInt, participantId)
      .input("drawId", sql.BigInt, participant.SorteioID)
      .input("name", sql.NVarChar(250), participant.Nome)
      .input("source", sql.NVarChar(100), participant.Grupo)
      .input("destination", sql.NVarChar(100), destination)
      .query(`
        UPDATE dbo.SorteioParticipantes SET Grupo = @destination WHERE ID = @id;
        INSERT dbo.SorteioAlteracoes
          (SorteioID, ParticipanteID, Nome, GrupoOrigem, GrupoDestino)
        VALUES (@drawId, @id, @name, @source, @destination);
      `);

    await transaction.commit();
    return { moved: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}