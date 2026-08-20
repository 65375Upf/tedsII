import db from '../db.js';

const CAMPOS_PUBLICOS = `
  id, nome, email, cpf, role, cargo, departamento,
  data_admissao AS dataAdmissao, valor_hora AS valorHora,
  carga_horaria_diaria AS cargaHorariaDiaria,
  carga_horaria_semanal AS cargaHorariaSemanal, criado_em AS criadoEm
`;

export function criar({
  nome,
  email,
  senhaHash,
  cpf,
  role,
  cargo,
  departamento,
  dataAdmissao,
  valorHora,
  cargaHorariaDiaria,
  cargaHorariaSemanal,
}) {
  const stmt = db.prepare(`
    INSERT INTO usuarios (
      nome, email, senha_hash, cpf, role, cargo, departamento,
      data_admissao, valor_hora, carga_horaria_diaria, carga_horaria_semanal
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    nome,
    email,
    senhaHash,
    cpf,
    role,
    cargo,
    departamento,
    dataAdmissao,
    valorHora,
    cargaHorariaDiaria,
    cargaHorariaSemanal
  );
  return buscarPorId(info.lastInsertRowid);
}

export function contarUsuarios() {
  return db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total;
}

export function listar() {
  return db.prepare(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios`).all();
}

export function buscarPorId(id) {
  return db.prepare(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = ?`).get(id);
}

// Continua retornando a linha inteira (com senha_hash) — uso interno do login/validações.
export function buscarPorEmail(email) {
  return db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
}

export function buscarPorCpf(cpf) {
  return db.prepare('SELECT * FROM usuarios WHERE cpf = ?').get(cpf);
}

export function atualizar(id, dados) {
  const atual = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!atual) return null;

  const {
    nome = atual.nome,
    email = atual.email,
    senhaHash = atual.senha_hash,
    cpf = atual.cpf,
    role = atual.role,
    cargo = atual.cargo,
    departamento = atual.departamento,
    dataAdmissao = atual.data_admissao,
    valorHora = atual.valor_hora,
    cargaHorariaDiaria = atual.carga_horaria_diaria,
    cargaHorariaSemanal = atual.carga_horaria_semanal,
  } = dados;

  db.prepare(`
    UPDATE usuarios SET
      nome = ?, email = ?, senha_hash = ?, cpf = ?, role = ?, cargo = ?,
      departamento = ?, data_admissao = ?, valor_hora = ?,
      carga_horaria_diaria = ?, carga_horaria_semanal = ?
    WHERE id = ?
  `).run(
    nome,
    email,
    senhaHash,
    cpf,
    role,
    cargo,
    departamento,
    dataAdmissao,
    valorHora,
    cargaHorariaDiaria,
    cargaHorariaSemanal,
    id
  );
  return buscarPorId(id);
}

// Igual ao "atualizar", mas cada campo ausente em `campos` preserva o valor atual
// (== PATCH). Mantido separado de "atualizar" (== PUT) para deixar a intenção clara
// nos controllers, ainda que a query SQL seja a mesma internamente.
export function atualizarParcial(id, campos) {
  return atualizar(id, campos);
}

export function buscarRemuneracao(id) {
  return db
    .prepare(
      `SELECT id AS usuarioId, valor_hora AS valorHora,
              carga_horaria_diaria AS cargaHorariaDiaria,
              carga_horaria_semanal AS cargaHorariaSemanal
       FROM usuarios WHERE id = ?`
    )
    .get(id);
}

export function atualizarRemuneracao(id, { valorHora, cargaHorariaDiaria, cargaHorariaSemanal }) {
  const atual = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!atual) return null;

  db.prepare(`
    UPDATE usuarios SET valor_hora = ?, carga_horaria_diaria = ?, carga_horaria_semanal = ?
    WHERE id = ?
  `).run(
    valorHora ?? atual.valor_hora,
    cargaHorariaDiaria ?? atual.carga_horaria_diaria,
    cargaHorariaSemanal ?? atual.carga_horaria_semanal,
    id
  );
  return buscarRemuneracao(id);
}

export function remover(id) {
  const info = db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  return info.changes > 0;
}

// ---------------------------------------------------------------------------
// Pré-cálculo de Salário
// ---------------------------------------------------------------------------

export function buscarUsuarioPorId(id) {
  return db.prepare(`
    SELECT
      u.id AS usuarioId,
      u.nome,
      u.email,
      u.cpf,
      u.role,
      u.cargo,
      u.departamento,
      u.data_admissao AS dataAdmissao,
      u.valor_hora AS valorHora,
      u.carga_horaria_diaria AS cargaHorariaDiaria,
      u.carga_horaria_semanal AS cargaHorariaSemanal
    FROM usuarios u
    WHERE u.id = ?
  `).get(id);
}

export function buscarHorasPorPeriodo(usuarioId, dataInicio, dataFim) {
  return db.prepare(`
    SELECT
      rp.data,
      rp.entrada,
      rp.saida_almoco,
      rp.retorno_almoco,
      rp.saida
    FROM registros_ponto rp
    WHERE rp.usuario_id = ?
      AND rp.data BETWEEN ? AND ?
    ORDER BY rp.data
  `).all(usuarioId, dataInicio, dataFim);
}

export function buscarRegrasDoPeriodo(usuarioId, dataInicio, dataFim) {
  return db.prepare(`
    SELECT
      r.id,
      r.tipo,
      r.descricao,
      r.natureza,
      r.percentual,
      r.valor_fixo,
      r.ativo
    FROM regras_desconto_adicional r
    WHERE r.ativo = 1
    ORDER BY r.id
  `).all();
}

export function buscarRegrasAtivas() {
  return db.prepare(`
    SELECT
      r.id,
      r.tipo,
      r.descricao,
      r.natureza,
      r.percentual,
      r.valor_fixo,
      r.ativo
    FROM regras_desconto_adicional r
    WHERE r.ativo = 1
    ORDER BY r.id
  `).all();
}
