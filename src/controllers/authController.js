import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as usuarioModel from '../models/usuarioModel.js';
import ApiError from '../errors/apiError.js';
import { JWT_SECRET } from '../middlewares/auth.js';

const CPF_REGEX = /^\d{11}$/;
const ROLES_VALIDAS = ['ADMIN', 'EMPLOYEE'];

function validarCamposCadastro(body) {
  const {
    nome,
    email,
    senha,
    cpf,
    role,
    cargo,
    departamento,
    dataAdmissao,
    valorHora,
    cargaHorariaDiaria,
    cargaHorariaSemanal,
  } = body;

  if (!nome || !email || !senha || !cpf || !role || !cargo || !departamento || !dataAdmissao) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      "Os campos 'nome', 'email', 'senha', 'cpf', 'role', 'cargo', 'departamento' e 'dataAdmissao' são obrigatórios."
    );
  }
  if (!CPF_REGEX.test(cpf)) {
    throw new ApiError(400, 'VALIDATION_ERROR', "O campo 'cpf' deve conter 11 dígitos numéricos.");
  }
  if (!ROLES_VALIDAS.includes(role)) {
    throw new ApiError(400, 'VALIDATION_ERROR', "O campo 'role' deve ser 'ADMIN' ou 'EMPLOYEE'.");
  }
  if ([valorHora, cargaHorariaDiaria, cargaHorariaSemanal].some((v) => typeof v !== 'number' || v <= 0)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      "Os campos 'valorHora', 'cargaHorariaDiaria' e 'cargaHorariaSemanal' devem ser números maiores que zero."
    );
  }
  if (new Date(dataAdmissao) > new Date()) {
    throw new ApiError(400, 'VALIDATION_ERROR', "O campo 'dataAdmissao' não pode ser uma data futura.");
  }
}

export async function registrar(req, res) {
  const totalUsuarios = usuarioModel.contarUsuarios();

  // Bootstrap: o primeiro usuário do sistema pode se cadastrar sem token (vira o ADMIN inicial).
  // A partir do segundo em diante, só um ADMIN autenticado pode cadastrar novos usuários.
  if (totalUsuarios > 0) {
    if (!req.usuario) {
      throw new ApiError(401, 'UNAUTHORIZED', 'É necessário estar autenticado para cadastrar novos usuários.');
    }
    if (req.usuario.role !== 'ADMIN') {
      throw new ApiError(403, 'FORBIDDEN', 'Apenas administradores podem cadastrar novos usuários.');
    }
  }

  validarCamposCadastro(req.body);
  const { nome, email, senha, cpf, role, cargo, departamento, dataAdmissao, valorHora, cargaHorariaDiaria, cargaHorariaSemanal } = req.body;

  if (usuarioModel.buscarPorEmail(email)) {
    throw new ApiError(409, 'EMAIL_IN_USE', 'Este e-mail já está cadastrado.');
  }
  if (usuarioModel.buscarPorCpf(cpf)) {
    throw new ApiError(409, 'CPF_IN_USE', 'Este CPF já está cadastrado.');
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const usuario = usuarioModel.criar({
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
  });

  res.status(201).location(`/usuarios/${usuario.id}`).json(usuario);
}

export async function login(req, res) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    throw new ApiError(400, 'VALIDATION_ERROR', "Os campos 'email' e 'senha' são obrigatórios.");
  }

  const usuario = usuarioModel.buscarPorEmail(email);
  const senhaValida = usuario && (await bcrypt.compare(senha, usuario.senha_hash));

  if (!senhaValida) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  }

  const token = jwt.sign(
    { sub: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role },
  });
}

export function me(req, res) {
  const usuario = usuarioModel.buscarPorId(req.usuario.sub);
  if (!usuario) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');
  }
  res.json(usuario);
}
