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
        UsuarioID int NULL,
        TipoSorteio nvarchar(20) NOT NULL,
        DataHora datetime2(0) NOT NULL CONSTRAINT DF_Sorteios_DataHora DEFAULT SYSDATETIME(),
        QuantidadeParticipantes int NOT NULL,
        CONSTRAINT CK_Sorteios_Tipo CHECK (TipoSorteio IN (N'individual', N'groups', N'pairs'))
    );

    CREATE INDEX IX_Sorteios_DataHora ON dbo.Sorteios (DataHora DESC, ID DESC);
END;
GO

IF OBJECT_ID(N'dbo.Usuarios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Usuarios (
        ID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Usuarios PRIMARY KEY,
        NomeUsuario nvarchar(100) NOT NULL,
        SenhaHash char(128) NOT NULL,
        SenhaSalt char(32) NOT NULL,
        PalavraChaveHash char(128) NOT NULL,
        PalavraChaveSalt char(32) NOT NULL,
        DataCriacao datetime2(0) NOT NULL CONSTRAINT DF_Usuarios_DataCriacao DEFAULT SYSDATETIME()
    );

END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Usuarios') AND name = N'UX_Usuarios_NomeUsuario'
)
BEGIN
    CREATE UNIQUE INDEX UX_Usuarios_NomeUsuario ON dbo.Usuarios (NomeUsuario);
END;
GO

IF OBJECT_ID(N'dbo.Sessoes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Sessoes (
        TokenHash char(64) NOT NULL CONSTRAINT PK_Sessoes PRIMARY KEY,
        UsuarioID int NOT NULL,
        ExpiraEm datetime2(0) NOT NULL,
        CONSTRAINT FK_Sessoes_Usuarios FOREIGN KEY (UsuarioID)
            REFERENCES dbo.Usuarios (ID) ON DELETE CASCADE
    );

END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Sessoes') AND name = N'IX_Sessoes_ExpiraEm'
)
BEGIN
    CREATE INDEX IX_Sessoes_ExpiraEm ON dbo.Sessoes (ExpiraEm);
END;
GO

IF OBJECT_ID(N'dbo.SorteioParticipantes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SorteioParticipantes (
        ID bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_SorteioParticipantes PRIMARY KEY,
        SorteioID bigint NOT NULL,
        UsuarioID int NULL,
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
        UsuarioID int NULL,
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

IF COL_LENGTH(N'dbo.Sorteios', N'UsuarioID') IS NULL
    ALTER TABLE dbo.Sorteios ADD UsuarioID int NULL;
GO

IF COL_LENGTH(N'dbo.SorteioParticipantes', N'UsuarioID') IS NULL
    ALTER TABLE dbo.SorteioParticipantes ADD UsuarioID int NULL;
GO

IF COL_LENGTH(N'dbo.SorteioAlteracoes', N'UsuarioID') IS NULL
    ALTER TABLE dbo.SorteioAlteracoes ADD UsuarioID int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Sorteios_Usuarios')
    ALTER TABLE dbo.Sorteios ADD CONSTRAINT FK_Sorteios_Usuarios
        FOREIGN KEY (UsuarioID) REFERENCES dbo.Usuarios (ID);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_SorteioParticipantes_Usuarios')
    ALTER TABLE dbo.SorteioParticipantes ADD CONSTRAINT FK_SorteioParticipantes_Usuarios
        FOREIGN KEY (UsuarioID) REFERENCES dbo.Usuarios (ID);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_SorteioAlteracoes_Usuarios')
    ALTER TABLE dbo.SorteioAlteracoes ADD CONSTRAINT FK_SorteioAlteracoes_Usuarios
        FOREIGN KEY (UsuarioID) REFERENCES dbo.Usuarios (ID);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Sorteios') AND name = N'IX_Sorteios_UsuarioID_DataHora'
)
    CREATE INDEX IX_Sorteios_UsuarioID_DataHora ON dbo.Sorteios (UsuarioID, DataHora DESC, ID DESC);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.SorteioParticipantes') AND name = N'IX_SorteioParticipantes_UsuarioID'
)
    CREATE INDEX IX_SorteioParticipantes_UsuarioID ON dbo.SorteioParticipantes (UsuarioID, SorteioID, Ordem);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.SorteioAlteracoes') AND name = N'IX_SorteioAlteracoes_UsuarioID'
)
    CREATE INDEX IX_SorteioAlteracoes_UsuarioID ON dbo.SorteioAlteracoes (UsuarioID, SorteioID, DataHora, ID);
GO

CREATE OR ALTER VIEW dbo.vwHistoricoSorteios
AS
    SELECT
        participante.ID,
        participante.SorteioID,
        sorteio.UsuarioID,
        participante.UsuarioID AS ParticipanteUsuarioID,
        participante.Nome,
        participante.Grupo,
        sorteio.TipoSorteio,
        sorteio.DataHora,
        sorteio.QuantidadeParticipantes,
        participante.Ordem
    FROM dbo.SorteioParticipantes AS participante
    INNER JOIN dbo.Sorteios AS sorteio ON sorteio.ID = participante.SorteioID;
GO