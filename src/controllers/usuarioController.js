import bcrypt from 'bcryptjs';
import * as usuarioModel from '../models/usuarioModel.js';
import ApiError from '../errors/apiError.js';

const CAMPOS_SOMENTE_ADMIN = ['role', 'cargo', 'departamento', 'valorHora', 'cargaHorariaDiaria', 'cargaHorariaSemanal', 'cpf'];

export function listar(req, res) {
  res.json(usuarioModel.listar());
}

export function buscarPorId(req, res) {
  const id = Number(req.params.id);

  if (req.usuario.role !== 'ADMIN' && req.usuario.sub !== id) {
    throw new ApiError(403, 'FORBIDDEN', 'Você só pode consultar o seu próprio usuário.');
  }

  const usuario = usuarioModel.buscarPorId(id);
  if (!usuario) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');
  }
  res.json(usuario);
}

export async function substituir(req, res) {
  // PUT: somente ADMIN, substitui o cadastro por completo.
  const id = Number(req.params.id);
  const { nome, email, senha, cpf, role, cargo, departamento, dataAdmissao, valorHora, cargaHorariaDiaria, cargaHorariaSemanal } = req.body;

  if (!usuarioModel.buscarPorId(id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');
  }
  if (!nome || !email || !cpf || !role || !cargo || !departamento || !dataAdmissao || !valorHora || !cargaHorariaDiaria || !cargaHorariaSemanal) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Todos os campos do cadastro são obrigatórios em um PUT.');
  }

  const outroEmail = usuarioModel.buscarPorEmail(email);
  if (outroEmail && outroEmail.id !== id) {
    throw new ApiError(409, 'EMAIL_IN_USE', 'Este e-mail já está cadastrado.');
  }
  const outroCpf = usuarioModel.buscarPorCpf(cpf);
  if (outroCpf && outroCpf.id !== id) {
    throw new ApiError(409, 'CPF_IN_USE', 'Este CPF já está cadastrado.');
  }

  const senhaHash = senha ? await bcrypt.hash(senha, 10) : undefined;
  res.json(
    usuarioModel.atualizar(id, {
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
    })
  );
}

export async function atualizarParcial(req, res) {
  const id = Number(req.params.id);
  const souAdmin = req.usuario.role === 'ADMIN';
  const souEuMesmo = req.usuario.sub === id;

  if (!souAdmin && !souEuMesmo) {
    throw new ApiError(403, 'FORBIDDEN', 'Você só pode alterar o seu próprio usuário.');
  }
  if (!usuarioModel.buscarPorId(id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');
  }
  if (Object.keys(req.body).length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Envie ao menos um campo para atualizar.');
  }

  // EMPLOYEE não pode alterar campos sensíveis, nem os próprios.
  if (!souAdmin) {
    const campoNaoPermitido = CAMPOS_SOMENTE_ADMIN.find((campo) => campo in req.body);
    if (campoNaoPermitido) {
      throw new ApiError(400, 'VALIDATION_ERROR', `O campo '${campoNaoPermitido}' só pode ser alterado por um administrador.`);
    }
  }

  const { nome, email, senha } = req.body;

  if (email) {
    const outro = usuarioModel.buscarPorEmail(email);
    if (outro && outro.id !== id) {
      throw new ApiError(409, 'EMAIL_IN_USE', 'Este e-mail já está cadastrado.');
    }
  }

  const senhaHash = senha ? await bcrypt.hash(senha, 10) : undefined;
  const dados = souAdmin ? { ...req.body, senhaHash } : { nome, email, senhaHash };
  res.json(usuarioModel.atualizarParcial(id, dados));
}

export function remover(req, res) {
  const removido = usuarioModel.remover(Number(req.params.id));
  if (!removido) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');
  }
  res.status(204).send();
}

// ---------------------------------------------------------------------------
// Remuneração
// ---------------------------------------------------------------------------

export function buscarRemuneracao(req, res) {
  const id = Number(req.params.id);

  if (req.usuario.role !== 'ADMIN' && req.usuario.sub !== id) {
    throw new ApiError(403, 'FORBIDDEN', 'Você só pode consultar a sua própria remuneração.');
  }

  const remuneracao = usuarioModel.buscarRemuneracao(id);
  if (!remuneracao) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');
  }
  res.json(remuneracao);
}

export function atualizarRemuneracao(req, res) {
  const id = Number(req.params.id);
  const { valorHora, cargaHorariaDiaria, cargaHorariaSemanal } = req.body;

  if (!usuarioModel.buscarPorId(id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');
  }
  if (valorHora === undefined && cargaHorariaDiaria === undefined && cargaHorariaSemanal === undefined) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Envie ao menos um campo para atualizar.');
  }
  const valores = [valorHora, cargaHorariaDiaria, cargaHorariaSemanal].filter((v) => v !== undefined);
  if (valores.some((v) => typeof v !== 'number' || v <= 0)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Os valores de remuneração devem ser números maiores que zero.');
  }

  res.json(usuarioModel.atualizarRemuneracao(id, { valorHora, cargaHorariaDiaria, cargaHorariaSemanal }));
}
