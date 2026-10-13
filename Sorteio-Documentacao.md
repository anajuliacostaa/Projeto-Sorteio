# Sorteio

Aplicativo full stack para sortear participantes individualmente, em grupos ou em duplas. A interface usa React e Vite; a API local usa Node.js e Express e mantém a conexão com o SQL Server `WK-245`.

## Como abrir

Instale Node.js 22.12 ou superior (x64) e o ODBC Driver 18 para SQL Server. Execute [`Iniciar-Sorteio.bat`](Iniciar-Sorteio.bat): na primeira execução ele instala as dependências e compila a interface, depois abre `http://localhost:8765/`. Mantenha a janela do Node aberta enquanto usar o aplicativo; pressione `Ctrl+C` para encerrar. Os nomes da lista continuam salvos no perfil local do navegador.

O servidor usa autenticação integrada do Windows por meio de `msnodesqlv8`. A conta Windows que executar o Node precisa ter permissão de leitura e gravação no banco `SorteioDB`. O SQL Server `WK-245` e o ODBC Driver 18 (64-bit) devem estar disponíveis. O serviço web escuta somente em `127.0.0.1`.

O banco e as tabelas desta instalação foram criados pelo script [`Sorteio-Banco.sql`](Sorteio-Banco.sql), executado com `sqlcmd` no servidor `WK-245`. Para preparar outra máquina ou recriar o esquema, execute o script com uma conta autorizada a criar bancos de dados.

## Como usar

1. Digite ou cole os nomes no campo **Participantes**, um nome por linha.
2. Escolha **Em grupos**, **Individual** ou **Duplas**.
3. No modo **Em grupos**, informe a quantidade desejada de grupos.
4. Clique em **Sortear** para gerar e salvar o resultado no banco.
5. Use **Copiar resultado** para copiar os nomes sorteados. O resultado mais recente volta a aparecer ao atualizar ou reabrir a página.
6. Abra **Histórico de sorteios** para consultar os resultados separados por dia. Em grupos ou duplas, arraste um participante para outro grupo; a mudança é salva e aparece no histórico.
7. Alterne entre tema claro e escuro pela lua no canto superior direito.

Linhas vazias são ignoradas. Espaços no começo e no fim de cada nome são removidos. Nomes repetidos são aceitos e contam como participantes distintos; acentos e caracteres especiais são preservados.

## Modos de sorteio

### Individual

Escolhe um participante aleatoriamente e exibe somente o nome sorteado. É necessário haver pelo menos um nome na lista.

### Em grupos

O número de grupos deve ser pelo menos 2 e não pode superar a quantidade de participantes. Os participantes são embaralhados e distribuídos entre os grupos.

A distribuição é sempre a mais equilibrada possível: os grupos terão o mesmo tamanho quando a divisão for exata; caso contrário, a diferença entre o maior e o menor grupo será de uma pessoa no máximo. Quando houver essa diferença, um aviso informa que a distribuição mais equilibrada possível foi aplicada.

### Duplas

Os participantes são embaralhados e agrupados de dois em dois. É necessário haver pelo menos duas pessoas.

Com uma quantidade ímpar, uma pessoa inevitavelmente ficará sem par. O resultado identifica essa pessoa como **Sem dupla** e abre um pop-up informativo.

## Aleatoriedade

O aplicativo usa `crypto.getRandomValues()` do navegador com rejeição de valores fora do intervalo, evitando viés na escolha de índices. Em seguida, aplica o algoritmo Fisher–Yates para embaralhar os participantes antes de formar os grupos ou as duplas.

Cada clique em **Sortear** realiza um novo sorteio independente. A aleatoriedade não garante resultados diferentes em execuções sucessivas: uma repetição pode acontecer por acaso.

## Salvamento e privacidade

Os resultados e mudanças de grupo são salvos no SQL Server `WK-245`, no banco `SorteioDB`. A lista que alimenta o próximo sorteio permanece no armazenamento local do navegador (`localStorage`), usando a chave `sorteio.participantes.v1`; ela não é sincronizada entre dispositivos. O tema escolhido também fica salvo localmente.

Cada sorteio, participante e alteração é associado ao `UsuarioID` autenticado. O histórico e o resultado atual mostram somente registros do usuário logado, e a API impede movimentar participantes de outra conta. Registros anteriores à autenticação permanecem com `UsuarioID` nulo e não são exibidos no histórico de nenhum usuário, pois não há autoria confiável para atribuí-los. Na migração deste ambiente, 32 sorteios, 252 participantes e 19 alterações permaneceram sem proprietário; os dados continuam preservados no banco.

As tabelas são `dbo.Sorteios` (usuário, tipo, data/hora e quantidade), `dbo.SorteioParticipantes` (sorteio, usuário, nome, grupo e ordem no resultado) e `dbo.SorteioAlteracoes` (sorteio, usuário, grupo de origem/destino e data/hora da movimentação). A view `dbo.vwHistoricoSorteios` inclui os IDs de usuário do sorteio e do participante. A API registra sorteio e participantes na mesma transação.

## Estrutura e stacks

O projeto é dividido em frontend, API e banco de dados:

| Camada | Tecnologia | Responsabilidade |
| --- | --- | --- |
| Interface | React, Vite, HTML e CSS | Formulário, sorteio aleatório, menus, temas, histórico, arrastar e soltar e chamadas HTTP. |
| Backend local | Node.js, Express, `mssql` e `msnodesqlv8` | Servir a interface compilada, expor a API HTTP e executar operações parametrizadas no banco com autenticação Windows. |
| Banco de dados | Microsoft SQL Server, T-SQL e `sqlcmd` | Persistir sorteios, participantes e auditoria de mudanças. |

Arquivos principais:

- `client/src/App.jsx`: interface React, validação e interação com a API.
- `client/src/AuthScreen.jsx`: telas de login, cadastro, recuperação de senha e perfil.
- `client/src/styles.css`: estilos responsivos e temas claro/escuro.
- `server/app.js`: rotas Express e entrega da interface compilada.
- `server/authRepository.js`: cadastro, validação de credenciais, hash `scrypt` e sessões persistidas.
- `server/drawRepository.js`: consultas, validações e transações de sorteios, filtradas por usuário.
- `server/db.js`: conexão integrada com o SQL Server `WK-245` via ODBC Driver 18.
- `Sorteio-Banco.sql`: criação idempotente do banco `SorteioDB`, tabelas, índices e view de consulta.
- `Iniciar-Sorteio.bat`: instala dependências se necessário, compila a interface e inicia a aplicação Node.
- `.env.example`: exemplo de configuração local; copie para `.env` apenas se precisar alterar host, porta ou banco.
- `Sorteio-Documentacao.md`: este guia técnico e funcional.

O Node.js 22.12+ e npm são necessários. O pacote nativo `msnodesqlv8` usa o ODBC Driver 18 instalado no Windows. As dependências ficam em `package.json`; a saída compilada é criada em `dist/client`. A conta Windows do processo Node precisa ter permissões nas tabelas do banco.

### Caminho de uma operação

1. O navegador envia as credenciais; o servidor verifica hashes `scrypt` e cria uma sessão em cookie `HttpOnly`.
2. O navegador valida a lista e escolhe os participantes por meio de `crypto.getRandomValues()` e Fisher–Yates.
3. O JavaScript envia o resultado em JSON para `POST /api/draw`; o Express obtém o `UsuarioID` da sessão, nunca do corpo enviado pelo navegador.
4. O servidor grava sorteio e participantes com o mesmo `UsuarioID`, em uma transação SQL.
5. `GET /api/current` e `GET /api/history` filtram sorteios, participantes e alterações pelo usuário autenticado.
6. Ao arrastar alguém para outro grupo, `PUT /api/participants/{id}/move` confirma a autoria e grava a alteração para o mesmo usuário, na mesma transação.

Os nomes mostrados na tela são inseridos como texto, não como HTML, para evitar que caracteres especiais sejam interpretados como marcação.

## Contas de usuário

Execute `Sorteio-Banco.sql` com uma conta autorizada no SQL Server. O script é idempotente e cria as tabelas `dbo.Usuarios` e `dbo.Sessoes`, além de adicionar `UsuarioID` a `dbo.Sorteios`, `dbo.SorteioParticipantes` e `dbo.SorteioAlteracoes`. Ele também atualiza a view `dbo.vwHistoricoSorteios`. O cadastro salva hashes `scrypt` com salt individual para senha e palavra-chave. A sessão usa cookie `HttpOnly`, com token armazenado no banco somente como hash. Histórico, sorteio, perfil e movimentação exigem sessão ativa. A recuperação de senha valida a palavra-chave cadastrada e não envia e-mail.

Os `UsuarioID` dos registros novos são chaves estrangeiras para `dbo.Usuarios`. Os campos aceitam `NULL` para preservar registros legados sem atribuir a uma conta uma autoria que o banco antigo não registrava. Esses registros não são retornados pelas consultas autenticadas.

Rotas de conta: `GET /api/auth/session`, `GET /api/auth/username`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot`, `POST /api/auth/logout` e `PUT /api/auth/profile`.

### Tela de login e conta

Ao abrir a aplicação, o cliente consulta `GET /api/auth/session`. Se não houver sessão válida, exibe a tela **Entrar**, com os campos de nome de usuário e senha, além das opções **Criar conta** e **Esqueci a senha**. Se as credenciais não corresponderem, a mensagem é apresentada junto ao campo correspondente: **usuário não cadastrado** ou **senha incorreta**.

Em **Criar conta**, o nome é consultado no banco ao sair do campo. Enquanto a consulta acontece, a tela informa **Verificando usuário...**; depois mostra **usuário válido** em verde ou **usuário já cadastrado** em vermelho. O cadastro também pede senha, confirmação e palavra-chave de recuperação. Senhas diferentes são recusadas; após um cadastro aceito, a conta entra automaticamente.

Em **Esqueci a senha**, o usuário informa nome, palavra-chave cadastrada e nova senha com confirmação. A alteração só é concluída quando usuário e palavra-chave forem validados. Não há envio de e-mail.

Em **Meu perfil**, o usuário pode alterar o nome de usuário e a senha. Para trocar a senha, precisa informar a senha atual e confirmar a nova. **Logout** invalida a sessão no servidor e retorna à tela de entrada. O formulário preserva os temas claro e escuro da aplicação.

As senhas e palavras-chave são derivadas com `scrypt` e salts aleatórios individuais; não são armazenadas em texto puro. O navegador recebe um token de sessão aleatório em cookie `HttpOnly`; somente o hash do token é persistido no SQL Server. A sessão expira após sete dias, e as rotas protegidas validam sua associação ao usuário antes de consultar ou alterar dados.

## API HTTP

A API é servida pela mesma origem da página em `http://localhost:8765`; isso evita chamadas cross-origin do navegador. O bind em loopback limita o acesso à própria máquina. Todas as respostas JSON usam UTF-8.

| Método e rota | Uso | Resposta de sucesso |
| --- | --- | --- |
| `GET /` | Entregar a interface React compilada. | HTML da aplicação. |
| `GET /api/health` | Testar conexão com o banco. | `{"ok":true,"server":"wk-245","database":"SorteioDB"}`. |
| `GET /api/auth/session` | Consultar a sessão atual. | Usuário autenticado ou `null`. |
| `GET /api/auth/username` | Verificar disponibilidade do nome de usuário. | `{ "exists": boolean }`. |
| `POST /api/auth/register` | Criar conta e iniciar sessão. | HTTP `201` e usuário criado. |
| `POST /api/auth/login` | Validar credenciais e iniciar sessão. | Usuário autenticado. |
| `POST /api/auth/forgot` | Redefinir senha com palavra-chave válida. | `{ "ok": true }`. |
| `POST /api/auth/logout` | Encerrar sessão atual. | `{ "ok": true }`. |
| `PUT /api/auth/profile` | Atualizar usuário e/ou senha. | Usuário atualizado. |
| `GET /api/current` | Buscar o sorteio mais recente do usuário autenticado. | Um objeto próprio ou `null` quando ainda não existem registros. |
| `GET /api/history` | Buscar sorteios, participantes e auditoria do usuário autenticado, em ordem mais recente primeiro. | Array dos sorteios próprios. |
| `POST /api/draw` | Gravar sorteio e seus participantes para o usuário autenticado. | HTTP `201` e `{ "id": <id do sorteio> }`. |
| `PUT /api/participants/{id}/move` | Mover participante de um sorteio próprio para outro grupo. | `{ "moved": true }`; retorna `false` se já pertencer ao grupo e `404` se não pertencer ao usuário. |

Um objeto retornado pelas rotas de consulta inclui `id`, `type`, `date`, `total`, `participants` e `changes`. Cada participante inclui `id`, `name`, `group` e `order`; cada alteração inclui participante, grupo anterior, grupo de destino e data/hora.

Erros são respondidos como JSON no formato `{ "error": "mensagem" }`. Rotas inexistentes respondem `404`; falhas de validação respondem `400`, sessão ausente responde `401` e falhas de banco respondem `500`. Todas as rotas de sorteio e perfil exigem sessão, e o servidor deriva o proprietário da sessão validada. Consultas de disponibilidade de usuário usam `Cache-Control: no-store`. O acesso ao banco usa as credenciais Windows da conta que executa o Node.

## Banco de dados

O script cria o banco `SorteioDB` no servidor `WK-245` e pode ser executado novamente sem recriar objetos existentes. As identidades são `bigint IDENTITY`; campos de texto são Unicode (`nvarchar`) para preservar acentos.

| Objeto | Conteúdo |
| --- | --- |
| `dbo.Sorteios` | `ID`, `UsuarioID`, `TipoSorteio` (`individual`, `groups` ou `pairs`), `DataHora` (hora local do servidor SQL), `QuantidadeParticipantes`. |
| `dbo.SorteioParticipantes` | `ID`, `SorteioID`, `UsuarioID`, `Nome`, `Grupo` e `Ordem` de exibição. Um registro por participante efetivamente exibido no resultado; no modo individual, guarda o vencedor. |
| `dbo.SorteioAlteracoes` | `ID`, `SorteioID`, `UsuarioID`, `ParticipanteID`, `Nome`, `GrupoOrigem`, `GrupoDestino` e `DataHora`; cada movimento efetivo gera uma linha de auditoria. |
| `dbo.Usuarios` | Nome de usuário, hashes `scrypt` e salts individuais da senha e palavra-chave de recuperação. |
| `dbo.Sessoes` | Hash do token de sessão, usuário associado e horário de expiração. |
| `dbo.vwHistoricoSorteios` | View que junta participante e sorteio para consultar IDs de usuário, ID, nome, grupo, tipo, data/hora, quantidade e ordem. |

As tabelas têm chaves estrangeiras e índices para recuperar dados por usuário e sorteio. A gravação do sorteio com seus participantes e a mudança de grupo com sua auditoria são transacionais: ou todas as operações correspondentes são confirmadas, ou são desfeitas. A autoria é verificada também na movimentação, de modo que conhecer o ID de um participante não permite alterar dados de outra conta.

Para recriar o esquema em uma instalação autorizada, execute `sqlcmd -S wk-245 -E -i Sorteio-Banco.sql`. Esse comando usa autenticação integrada do Windows; não contém senha no arquivo.

## Regras e validações

No navegador, linhas vazias da lista são ignoradas e espaços periféricos são removidos. Nomes repetidos são permitidos e tratados como participantes distintos. A validação antes do envio exige pelo menos um nome para sorteio individual, dois para duplas e número inteiro de grupos entre 2 e a quantidade de participantes.

Grupos e duplas são embaralhados criptograficamente e distribuídos para que os tamanhos difiram no máximo em uma pessoa. Para duplas com quantidade ímpar, sobra uma pessoa marcada **Sem dupla**. O modo individual grava e exibe somente o nome sorteado, mantendo a quantidade original de participantes no cabeçalho.

O backend aceita apenas os tipos `individual`, `groups` e `pairs`; exige entre 1 e 300 participantes; exige nomes não vazios com até 250 caracteres e grupos com até 100 caracteres. No movimento, exige destino não vazio com até 100 caracteres e ID de participante existente. A restrição `CHECK` da tabela também limita os tipos válidos.

O formulário e a lista de entrada permanecem no navegador. O salvamento automático dos nomes usa `localStorage`; isso não é cópia de segurança nem sincronização. Resultados, grupos sorteados e alterações só ficam disponíveis por meio do SQL Server e da API em execução.

## Cenários de conferência

- **Individual:** informe alguns nomes, selecione o modo e confirme que um único participante aparece.
- **Grupos exatos:** informe 8 participantes e 4 grupos; confirme que cada grupo recebe 2 pessoas e que nenhum aviso de desigualdade aparece.
- **Grupos não exatos:** informe 7 participantes e 3 grupos; confirme tamanhos 3, 2 e 2 e o pop-up com a distribuição.
- **Duplas exatas:** informe 6 participantes; confirme a criação de 3 duplas sem aviso de sobra.
- **Duplas ímpares:** informe 5 participantes; confirme 2 duplas, uma pessoa em **Sem dupla** e o pop-up correspondente.
- **Validação:** tente criar mais grupos que participantes ou sortear duplas com apenas um nome; o aplicativo deve apresentar uma mensagem de erro.
- **Persistência:** recarregue a página e confirme que o resultado mais recente continua visível; confira também a lista de entrada salva localmente.
- **Isolamento:** crie sorteios em duas contas diferentes; confirme que o histórico e o resultado atual de cada uma mostram somente seus próprios dados.
- **Movimentação isolada:** tente mover o participante de outra conta; a API deve responder `404` e não gravar alteração.
- **Contas:** cadastre uma conta, encerre a sessão, entre novamente e confira o perfil e a recuperação de senha.
- **Tema e confirmação:** faça um sorteio em tema claro e em tema escuro; confirme contraste legível no aviso de salvamento.

## Limitações e observações

- A contagem é feita por linhas preenchidas; não há identificação automática de nomes repetidos.
- Em duplas com quantidade ímpar, uma pessoa fica sem par. O aplicativo avisa, mas não cria uma equipe de três.
- A lista de entrada e o tema são salvos por navegador e perfil, não sincronizados entre dispositivos; resultados e alterações ficam no SQL Server.
- Para garantir aleatoriedade criptográfica, use um navegador moderno com suporte a `crypto.getRandomValues()`.

## Prompts do projeto

Abaixo estão os prompts usados para definir e evoluir o aplicativo.

### 1. Requisitos iniciais

```text
Gostaria que gerasse um aplicativo de sorteio.

Siga as seguintes instruções:

- deve ser em html;
- conter um campo do tipo texto, permitindo caracteres especiais, para informar os nomes, guardando as informações;
- conter um campo para informar se o sorteio será para formações de grupo ou individual (apresentando apenas o nome), penso em algo tipo um checkbox redondo para a seleção, apresentando duas opções:
* grupo e individual,
selecionando grupo, deverá habilitar um campo informando quantos grupos serão e após clicar em gerar o processo deverá montar os grupos sorteados
selecionando individual, retornará apenas um único nome sorteado.
- seguir a linha de aleatoriedade e não um padrão comum entre eles;
- deverá conter um botão "Sortear" onde ao clicar, o processo irá se iniciar.

Quero um front-end moderno e clean, bem usual e funcional.

Essa é a ideia inicial com os principais pontos que gostaria que seguisse.
```

### 2. Inclusão de duplas

```text
Pode incluir mais uma opção além de individual e grupos : duplas
```

### 3. Avisos e equilíbrio dos grupos

```text
quando a opção for duplas, quero que extoure um pop up na tela informando caso alguém fique sem dupla;
quando for grupos quero que extoure um pop up na tela informando se alfum grupo fique desigual.

Gostaria que sempre tente manter os grupos divididos de forma igualitária.
```

### 4. Solicitação da documentação

```text
perfeito!

Agora quero que monte um arquivo .md de uma autoexplicação do projeto
```

### 5. Persistência, histórico e novas funcionalidades — 08/10/2026

```text
Gostaria que pegássemos o projeto sorteio.html localizado em:
C:\Users\ana.arruda\Downloads
e transformássemos em uma aplicação com persistência no banco de dados, ou seja, que grave as informações em uma tabela, contendo ID, nome, grupo, tipo de sorteio, data e hora. (se for necessário algo a mais, pode implementar na tabela).

O banco pode ser criado pelo sql server management studio, que já está instalado nessa máquina, pode usar o nome do servidor wk-245 para criar o banco e tabelas necessárias. (Caso crie por outro lugar, me avise ao final da execução do prompt).

Com essas alterações, ao atualizarmos a página ou fecharmos, as últimas informações sorteadas deverão permanecer salvas em tela.

Gostaria de implementar então, um tipo de histórico de sorteio, penso em um botão nomeado em "demonstrar sorteio anterior", ou algo do tipo. Tendo como função - ao clicar no botão, será demonstrado o último sorteio realizado.

Poderíamos dividi-los em menus por exemplo. Utilizaríamos 2 menus: Sortear e Histórico de sorteios.
- Sortear: manteríamos a tela como está, incluindo as implementações mencionadas acima.
- Histórico de sorteio: demonstrar os históricos gravados na tabela, havendo uma quebra por dia e apresentando as informações gravadas em nossa tabela. (Podem haver 2 abas ou duas colunas apresentadas em um grid, demonstrando o que foi sorteado e se houverem alterações no sorteio).

Outra implementação que gostaria de incluir seria podermos deixar o usuário manusear os nomes sorteados, clicando em cima da caixa do nome e poder arrastá-lo para outro grupo. Acho interessante mantermos essas alterações salvas em uma tabela também, onde caso hajam alterações, atualizando a página, as alterações deverão ser mantidas e demonstradas corretamente.

Vamos implementar também o modo darkmode, onde o usuário possa escolher.

Em anexo, deixei um modelo de como gostaria que os menus se pareçam, pode manter as cores e fontes já utilizados, a imagem é apenas um norte para seguirmos com a estrutura de menus. Perceba que o menu se expande ao clicar em cima dele, demonstrando uma seta nos menus que se expandem.
```

### 6. Ajustes de acesso, menu e tema — 08/10/2026

```text
Está apresentando erro ao tentar sortear, Failed to fetch, acredito que possa ser a API.

Gostaria que retirasse o checkbox modo escuro, mantendo apenas a lua no canto superior direito.

Pode ajustar para que o menu fique localizado mais ao lado esquerdo da tela.
```

```text
Permanece o mesmo erro, ao abrir o iniciar-sorteio na pasta aparece essa mensagem.
```

### 7. Exibição do resultado — 08/10/2026

```text
Os sorteios estão gravando corretamente no banco de dados, mas não estão sendo apresentados em tela como estava antes.
```

### 8. Aviso de salvamento e documentação — 08/10/2026

```text
Pode apenas ajustar a demonstração do salvamento no banco de dados, verifique no darkmode e no modo normal.

Após os ajustes, gostaria que me explicasse a estrutura do projeto, quais stacks estão sendo utilizadas, tanto na web quanto no banco.

Ao final, gere um markdown explicando o projeto, por gentileza (incluindo as explicações da API, o backend, regras, validações, funcionalidades).
```

### 9. Registro dos prompts — 08/10/2026

```text
Pode incluir os prompts utilizados hoje no markdown também.
```

### 10. Login, cadastro e perfil — 13/10/2026

```text
Gostaria que de incluir uma tela de login para o nosso projeto de sorteio.

As informações do login principal deverão ser básicas:
- nome de usuário - validação se o usuário está inserido no banco (caso não esteja, exibir a mensagem abaixo do campo em vermelho "usuário não cadastrado");
- senha - validação se a senha está correta, conforme a criptografia do banco (caso não esteja, exibir a mensagem abaixo do campo em vermelho "senha incorreta").

As informações deverão ser gravadas na tabela, utilizando uma criptografia para a senha.

Deverá conter também uma opção para o cadastro incial, caso o usuário não possua uma conta, e uma opção de esqueci a senha.

Cadastro incial:
informações necessárias:
- nome de usuário - realizar a validação se o nome de usuário já não existir cadastrado a tabela (se já existir: exibir a mensagem informativa abaixo do campo na coloração vermelha - "usuário já cadastrado"), (se não existir, exibir a mensagem abaixo do campo na coloração verde - "usuário válido");
- senha: cadastro da senha do usuário, permitidos todos os tipos de caracteres;
- confirmação de senha: campo para o usuário informar a senha novamente para validação.
- Palavra chave para esquecimento de senha: nesse campo, o usuário deverá informar uma palavra a utilizar no caso de esquecimento de senha (servirá como uma validação de que é ele mesmo quem solicita a alteração, já que não iremos disparar emails para a alteração)
- Botão "Cadastar": ao apertar o botão as informações serão inseridas na tabela e o usuário será direcionado para a tela inicial do sorteador.

Esqueci a senha:
informações necessárias:
- nome de usuário - validação se o usuário está inserido no banco (caso não esteja, exibir a mensagem abaixo do campo em vermelho "usuário não cadastrado")
- palavra chave - validação da palavra chave cadastrada no banco de acordo com o usuário informado (caso não esteja, exibir a mensagem abaixo do campo em vermelho "palavra chave incorreta")
- nova senha:
- confirmação de senha:

A senha só poderá ser trocada caso todas as informações estejam validadas de acordo com o informado no banco.

No menu inicial do sorteador, deverá ser incluído os menus:

Logout - ao clicar o usuário será redirecionado para o menu de login incial, saindo da sua conta;
Meu perfil - exibir as informações:
nome de usuário:
alterar senha:
Ambas as informações do menu Meu perfil poderão ser alteradas, onde ao realizar as alterações, as informações deverão obrigatóriamente ser alteradas no banco também.

Mantenha as mesmas fontes, e tonalidades já utilizadas no projeto, prezando pelos temas claro e escuro, conforme já acontece.

Continue utilizando node e react.
```

### 11. Validação de foco no cadastro — 13/10/2026

```text
na tela de cadastro incial, após preencher todos os campos corretamente, clicar em cima do nome de usuario e clicar fora do campo ou em outro campo, está havendo uma leve falha de exibição na mensagem de validação. Aparece a mensagem usuário já cadastrado rapidamente, antes da exibição correta de usuário válido.
Corrija o apontamento e verifique se nos demais campos está acontecendo a mesma coisa, por gentileza. Caso esteja, já realize as correções necessárias.
```

### 12. Persistência da falha de foco — 13/10/2026

```text
a falha de foco ainda continua nesses ms na tela.
```

### 13. Novo status HTTP observado — 13/10/2026

```text
continua com o mesmo apontamento, porém, agora é o status 200
```

### 14. Histórico isolado por usuário — 13/10/2026

~~~text
O histórico de sorteios deverá ser mantido por usuário, não exibindo se o usuário logado não for quem realizou o sorteio.
Pode relizar a alteração também nas tabela, dando um alter table add column usuario nas tabelas e views:
```
Sorteios
SorteioParticipantes
SorteioAlteracoes
vwHistoricoSorteios
```
~~~

### 15. Atualização da documentação — 13/10/2026

```text
atualize o markdown com as informações atuais do projeto, adicione também os prompts utilizados hoje
```
