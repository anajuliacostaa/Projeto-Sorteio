IF DB_ID(N'SorteioDB') IS NULL
BEGIN
    CREATE DATABASE SorteioDB;
END;
GO

USE SorteioDB;
GO

IF OBJECT_ID(N'dbo.Sorteios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Sorteios (
        ID bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Sorteios PRIMARY KEY,
        TipoSorteio nvarchar(20) NOT NULL,
        DataHora datetime2(0) NOT NULL CONSTRAINT DF_Sorteios_DataHora DEFAULT SYSDATETIME(),
        QuantidadeParticipantes int NOT NULL,
        CONSTRAINT CK_Sorteios_Tipo CHECK (TipoSorteio IN (N'individual', N'groups', N'pairs'))
    );

    CREATE INDEX IX_Sorteios_DataHora ON dbo.Sorteios (DataHora DESC, ID DESC);
END;
GO

IF OBJECT_ID(N'dbo.SorteioParticipantes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SorteioParticipantes (
        ID bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_SorteioParticipantes PRIMARY KEY,
        SorteioID bigint NOT NULL,
        Nome nvarchar(250) NOT NULL,
        Grupo nvarchar(100) NULL,
        Ordem int NOT NULL,
        CONSTRAINT FK_SorteioParticipantes_Sorteios FOREIGN KEY (SorteioID)
            REFERENCES dbo.Sorteios (ID) ON DELETE CASCADE
    );

    CREATE INDEX IX_SorteioParticipantes_SorteioID ON dbo.SorteioParticipantes (SorteioID, Ordem);
END;
GO

IF OBJECT_ID(N'dbo.SorteioAlteracoes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SorteioAlteracoes (
        ID bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_SorteioAlteracoes PRIMARY KEY,
        SorteioID bigint NOT NULL,
        ParticipanteID bigint NOT NULL,
        Nome nvarchar(250) NOT NULL,
        GrupoOrigem nvarchar(100) NULL,
        GrupoDestino nvarchar(100) NOT NULL,
        DataHora datetime2(0) NOT NULL CONSTRAINT DF_SorteioAlteracoes_DataHora DEFAULT SYSDATETIME(),
        CONSTRAINT FK_SorteioAlteracoes_Sorteios FOREIGN KEY (SorteioID)
            REFERENCES dbo.Sorteios (ID) ON DELETE CASCADE,
        CONSTRAINT FK_SorteioAlteracoes_Participantes FOREIGN KEY (ParticipanteID)
            REFERENCES dbo.SorteioParticipantes (ID)
    );

    CREATE INDEX IX_SorteioAlteracoes_SorteioID ON dbo.SorteioAlteracoes (SorteioID, DataHora, ID);
END;
GO

CREATE OR ALTER VIEW dbo.vwHistoricoSorteios
AS
    SELECT
        participante.ID,
        participante.SorteioID,
        participante.Nome,
        participante.Grupo,
        sorteio.TipoSorteio,
        sorteio.DataHora,
        sorteio.QuantidadeParticipantes,
        participante.Ordem
    FROM dbo.SorteioParticipantes AS participante
    INNER JOIN dbo.Sorteios AS sorteio ON sorteio.ID = participante.SorteioID;
GO