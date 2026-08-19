import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'usuarios.db');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// usuarios (tabela já existente — mantida como estava e migrada por ALTER TABLE)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Colunas novas exigidas pelo módulo de ponto/folha. Adicionadas via ALTER TABLE
// para não apagar os usuários que já existem no banco. A função é idempotente:
// rodar de novo (ex: toda vez que o servidor sobe) não dá erro.
const colunasExistentes = new Set(
  db.prepare('PRAGMA table_info(usuarios)').all().map((col) => col.name)
);

function adicionarColuna(definicaoSql, nomeColuna) {
  if (!colunasExistentes.has(nomeColuna)) {
    db.exec(`ALTER TABLE usuarios ADD COLUMN ${definicaoSql}`);
    colunasExistentes.add(nomeColuna);
  }
}

adicionarColuna('cpf TEXT', 'cpf');
// DEFAULT 'ADMIN' só é usado pelo ALTER TABLE para preencher retroativamente as linhas
// que já existiam antes do conceito de perfil (ex: o "Pablo" do seed) — todo cadastro
// novo daqui pra frente sempre informa `role` explicitamente (ver authController.registrar),
// então esse default nunca é aplicado a um cadastro feito depois desta migração.
adicionarColuna(
  "role TEXT NOT NULL DEFAULT 'ADMIN' CHECK(role IN ('ADMIN','EMPLOYEE'))",
  'role'
);
adicionarColuna('cargo TEXT', 'cargo');
adicionarColuna('departamento TEXT', 'departamento');
adicionarColuna('data_admissao TEXT', 'data_admissao');
adicionarColuna('valor_hora REAL', 'valor_hora');
adicionarColuna('carga_horaria_diaria REAL', 'carga_horaria_diaria');
adicionarColuna('carga_horaria_semanal REAL', 'carga_horaria_semanal');

//estou adicionando uma coluna para armazenar a biometria do usuario
adicionarColuna('biometria BLOB', 'biometria');

// UNIQUE em cpf precisa ser um índice separado: o SQLite não permite
// "ADD COLUMN ... UNIQUE" diretamente. Um índice único comum já trata
// múltiplos NULLs como distintos, então usuários antigos sem CPF não conflitam.
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_cpf ON usuarios(cpf)');

// ---------------------------------------------------------------------------
// registros_ponto (nova)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS registros_ponto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    entrada TEXT,
    saida_almoco TEXT,
    retorno_almoco TEXT,
    saida TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (usuario_id, data)
  )
`);

// ---------------------------------------------------------------------------
// regras_desconto_adicional (nova)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS regras_desconto_adicional (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK(tipo IN ('FALTA','ATRASO','VALE_TRANSPORTE','VALE_REFEICAO','IMPOSTO','OUTRO')),
    descricao TEXT NOT NULL,
    natureza TEXT NOT NULL CHECK(natureza IN ('DESCONTO','ADICIONAL')),
    percentual REAL,
    valor_fixo REAL,
    ativo INTEGER NOT NULL DEFAULT 1,
    CHECK (
      (percentual IS NOT NULL AND valor_fixo IS NULL) OR
      (percentual IS NULL AND valor_fixo IS NOT NULL)
    )
  )
`);

// ---------------------------------------------------------------------------
// folhas_pagamento (nova)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS folhas_pagamento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    periodo_inicio TEXT NOT NULL,
    periodo_fim TEXT NOT NULL,
    total_horas_normais REAL NOT NULL,
    total_horas_extras REAL NOT NULL,
    salario_bruto REAL NOT NULL,
    total_descontos REAL NOT NULL,
    total_adicionais REAL NOT NULL,
    salario_liquido REAL NOT NULL,
    gerado_em TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ---------------------------------------------------------------------------
// folha_itens (nova) — snapshot dos descontos/adicionais aplicados em cada folha
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS folha_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folha_id INTEGER NOT NULL REFERENCES folhas_pagamento(id) ON DELETE CASCADE,
    regra_id INTEGER REFERENCES regras_desconto_adicional(id),
    tipo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    natureza TEXT NOT NULL CHECK(natureza IN ('DESCONTO','ADICIONAL')),
    valor REAL NOT NULL
  )
`);

export default db;
