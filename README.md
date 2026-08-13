# API de Ponto Eletrônico (Node.js + Express)


Evolução da API de cadastro de usuários (Node.js, Express, SQLite via `better-sqlite3`,
autenticação JWT) para um **sistema de gerenciamento de relógio ponto**, com dois perfis de
acesso: **Colaboradores** (registram entrada/saída e acompanham suas horas) e
**Administradores/RH** (cadastram colaboradores, parametrizam remuneração e geram relatórios
de pagamento).

Este README descreve o que **já está implementado** e o que **ainda falta** implementar em
sala de aula. Veja o diagrama do banco em [`diagrama-er.md`](./diagrama-er.md).

## Pré-requisitos

- Node.js 18 ou mais recente

## Instalação e execução

```bash
cd exemplos/api-node
npm install
npm start
```

O servidor sobe em `http://localhost:3000`. O arquivo `usuarios.db` já vem com a estrutura de
tabelas migrada (veja "Banco de dados e migração" abaixo) e com um usuário `ADMIN` inicial.

Para desenvolvimento com reinício automático a cada alteração:

```bash
npm run dev
```

## Variáveis de ambiente (opcionais)

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do servidor |
| `JWT_SECRET` | `segredo-de-desenvolvimento` | Segredo usado para assinar/validar tokens JWT |
| `DB_PATH` | `./usuarios.db` | Caminho do arquivo SQLite |

```bash
JWT_SECRET=algo-mais-seguro PORT=4000 npm start
```

## Banco de dados e migração

O `db.js` cria/migra automaticamente todas as tabelas toda vez que o servidor sobe (é seguro
rodar várias vezes — a migração é idempotente). A tabela `usuarios`, que já existia, ganhou
colunas novas via `ALTER TABLE`; as demais tabelas (`registros_ponto`,
`regras_desconto_adicional`, `folhas_pagamento`, `folha_itens`) são novas.

> O usuário que já existia no banco antes da migração (`Pablo`) virou automaticamente
> `ADMIN` — é o único jeito de ter um administrador funcional logo de cara, já que novos
> cadastros exigem token de `ADMIN` (ver regra de bootstrap abaixo).

Veja o schema completo, com todos os campos de cada tabela, em
[`diagrama-er.md`](./diagrama-er.md).

## Perfis de acesso

- **`ADMIN`**: gestores e equipe de RH. Cadastra/edita/remove colaboradores, define
  remuneração, cadastra regras financeiras, gera e consulta folhas de qualquer colaborador.
- **`EMPLOYEE`**: colaboradores. Consulta e edita (parcialmente) os próprios dados, consulta a
  própria remuneração. Não acessa dados de outros colaboradores.

Toda rota protegida exige `Authorization: Bearer <token>`. O token é obtido em
`POST /auth/login` e carrega o `role` do usuário.

## O que já está implementado

### Autenticação e cadastro (`/auth`)

| Rota | Perfil | Descrição |
|---|---|---|
| `POST /auth/registrar` | bootstrap* ou `ADMIN` | Cadastra um novo usuário (colaborador ou admin) |
| `POST /auth/login` | público | Login por e-mail/senha, retorna `token` + dados do usuário |
| `GET /auth/me` | autenticado | Retorna os dados do próprio usuário logado |

\* **Regra de bootstrap**: se o banco não tiver nenhum usuário, o primeiro cadastro pode ser
feito sem token (vira o `ADMIN` inicial). Com o banco já populado (nosso caso, com o
`Pablo`), todo cadastro exige token de um `ADMIN` existente.

O cadastro exige: `nome`, `email`, `senha`, `cpf` (11 dígitos), `role` (`ADMIN`/`EMPLOYEE`),
`cargo`, `departamento`, `dataAdmissao`, `valorHora`, `cargaHorariaDiaria`,
`cargaHorariaSemanal`. `email` e `cpf` são únicos.

### Usuários (`/usuarios`)

| Rota | Perfil | Descrição |
|---|---|---|
| `GET /usuarios` | `ADMIN` | Lista todos os usuários |
| `GET /usuarios/:id` | `ADMIN` ou o próprio | Detalhe de um usuário |
| `PUT /usuarios/:id` | `ADMIN` | Substitui o cadastro por completo |
| `PATCH /usuarios/:id` | `ADMIN` ou o próprio | Atualização parcial (colaborador não altera campos sensíveis como `role`/`valorHora`) |
| `DELETE /usuarios/:id` | `ADMIN` | Remove um usuário |
| `GET /usuarios/:id/remuneracao` | `ADMIN` ou o próprio | Consulta `valorHora`/carga horária |
| `PATCH /usuarios/:id/remuneracao` | `ADMIN` | Atualiza `valorHora`/carga horária |

Respostas de usuário nunca incluem `senha`/`senha_hash`.

## O que ainda falta implementar

O restante dos módulos descritos no schema (tabelas já existem no banco, faltam os
endpoints) está dividido nas atividades da turma:

| Módulo | Onde entra | Atividades |
|---|---|---|
| Regras de desconto e adicionais | `regras_desconto_adicional` | cadastro/listagem, atualização/remoção |
| Marcação e histórico de ponto | `registros_ponto` | marcar, consultar hoje, histórico (próprio e admin) |
| Cálculo de horas trabalhadas/extras | serviço sobre `registros_ponto` | resumo de horas |
| Cálculo e geração de folha de pagamento | `folhas_pagamento` + `folha_itens` | pré-cálculo, geração, consulta |

Consulte os arquivos de atividades entregues em aula para o detalhamento de cada endpoint
(entrada, saída, regras de negócio e critérios de aceite).

## Testando com `curl`

```bash
# Login com o ADMIN inicial (redefina a senha do Pablo no seu ambiente antes de testar)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "pablo@exemplo.com", "senha": "SUA_SENHA"}'

# Dados do usuário logado
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Cadastrar um colaborador (precisa de token de ADMIN)
curl -X POST http://localhost:3000/auth/registrar \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Ana Silva", "email": "ana@exemplo.com", "senha": "senhaForte123",
    "cpf": "33344455566", "role": "EMPLOYEE", "cargo": "Analista de Suporte",
    "departamento": "Operações", "dataAdmissao": "2026-03-01",
    "valorHora": 25.5, "cargaHorariaDiaria": 8, "cargaHorariaSemanal": 44
  }'

# Listar usuários (ADMIN)
curl http://localhost:3000/usuarios \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Buscar por id (ADMIN ou o próprio usuário)
curl http://localhost:3000/usuarios/1 \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Consultar remuneração
curl http://localhost:3000/usuarios/1/remuneracao \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Atualizar remuneração (ADMIN)
curl -X PATCH http://localhost:3000/usuarios/1/remuneracao \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"valorHora": 28.0}'

# Atualizar parcialmente
curl -X PATCH http://localhost:3000/usuarios/1 \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"nome": "Ana S. Souza"}'

# Remover (ADMIN)
curl -X DELETE http://localhost:3000/usuarios/1 \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## Estrutura do projeto

```
api-node/
├── diagrama-er.md                   # schema do banco (Mermaid) + descrição das tabelas
├── server.js                        # ponto de entrada, sobe o servidor
└── src/
    ├── app.js                       # monta express + rotas + middlewares
    ├── db.js                        # conexão SQLite + migração de schema (idempotente)
    ├── models/usuarioModel.js       # queries SQL de usuários e remuneração
    ├── controllers/
    │   ├── authController.js       # registrar (com bootstrap de ADMIN)/login/me
    │   └── usuarioController.js    # CRUD de usuários + remuneração, com autorização por perfil
    ├── middlewares/
    │   ├── auth.js                  # valida o JWT (auth) e versão opcional (authOpcional)
    │   ├── permitir.js              # autorização por perfil (ex: permitir('ADMIN'))
    │   ├── errorHandler.js          # formata qualquer erro como JSON
    │   └── asyncHandler.js          # encaminha rejeições de Promise ao errorHandler
    ├── errors/apiError.js           # erro com status HTTP embutido
    └── routes/
        ├── authRoutes.js
        └── usuarioRoutes.js
```

Este projeto usa **ES Modules** (`import`/`export`), habilitado via `"type": "module"` no
`package.json`.

Para apagar o banco e recomeçar do zero (a migração recria toda a estrutura, mas você perde
os dados e volta a precisar do fluxo de bootstrap do primeiro `ADMIN`):

```bash
rm usuarios.db
```
