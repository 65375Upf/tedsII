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

// ---------------------------------------------------------------------------
// Pré-cálculo de Salário
// ---------------------------------------------------------------------------

export function preCalculaSalario(req, res) {
  const id = Number(req.params.id);
  const dataInicio = String(req.query.dataInicio || '').trim();
  const dataFim = String(req.query.dataFim || '').trim();

  if (!usuarioModel.buscarPorId(id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');
  }

  const inicioValida = !Number.isNaN(Date.parse(dataInicio));
  const fimValida = !Number.isNaN(Date.parse(dataFim));

  if (!inicioValida || !fimValida) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Período inválido. Datas em formato inválido.');
  }

  if (new Date(dataFim) < new Date(dataInicio)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'A data final deve ser maior ou igual à data inicial.');
  }

  const usuario = usuarioModel.buscarUsuarioPorId(id);
  const registrosPonto = usuarioModel.buscarHorasPorPeriodo(id, dataInicio, dataFim);

  if (!registrosPonto || registrosPonto.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Nenhum registro de horas encontrado para o período informado.');
  }

  // Calcular horas normais e extras a partir dos registros de ponto
  let totalHorasNormais = 0;
  let totalHorasExtras = 0;

  registrosPonto.forEach((registro) => {
    if (!registro.entrada || !registro.saida) return;

    let horasDodia = 0;
    if (registro.saida_almoco && registro.retorno_almoco) {
      const tempoEntradaAlmoco = (new Date(`2000-01-01 ${registro.saida_almoco}`) - new Date(`2000-01-01 ${registro.entrada}`)) / (1000 * 60 * 60);
      const tempoRetornoSaida = (new Date(`2000-01-01 ${registro.saida}`) - new Date(`2000-01-01 ${registro.retorno_almoco}`)) / (1000 * 60 * 60);
      horasDodia = tempoEntradaAlmoco + tempoRetornoSaida;
    } else {
      horasDodia = (new Date(`2000-01-01 ${registro.saida}`) - new Date(`2000-01-01 ${registro.entrada}`)) / (1000 * 60 * 60);
    }

    if (horasDodia > 8) {
      totalHorasNormais += 8;
      totalHorasExtras += horasDodia - 8;
    } else {
      totalHorasNormais += horasDodia;
    }
  });

  const horas = {
    totalHorasNormais: Number(totalHorasNormais.toFixed(2)),
    totalHorasExtras: Number(totalHorasExtras.toFixed(2)),
  };

  const regras = usuarioModel.buscarRegrasDoPeriodo(id, dataInicio, dataFim);
  const descontos = [];
  const adicionais = [];
  let totalDescontos = 0;
  let totalAdicionais = 0;

  const arredondar = (valor) => Number(Number(valor).toFixed(2));
  const formatarDecimal = (valor) => Number(valor).toFixed(2).toString();

  const salarioBrutoNormal = arredondar(horas.totalHorasNormais * usuario.valorHora);
  const salarioBrutoExtra = arredondar(horas.totalHorasExtras * usuario.valorHora * 1.5);
  const salarioBruto = arredondar(salarioBrutoNormal + salarioBrutoExtra);

  const regrasAtivas = (regras || []).filter((regra) => regra.ativo);

  if (regrasAtivas.length === 0) {
    const salarioLiquido = salarioBruto;
    return res.json({
      usuarioId: usuario.usuarioId,
      periodo: {
        inicio: dataInicio,
        fim: dataFim,
      },
      valorHora: formatarDecimal(usuario.valorHora),
      totalHorasNormais: formatarDecimal(horas.totalHorasNormais),
      totalHorasExtras: formatarDecimal(horas.totalHorasExtras),
      salarioBrutoNormal: formatarDecimal(salarioBrutoNormal),
      salarioBrutoExtra: formatarDecimal(salarioBrutoExtra),
      salarioBruto: formatarDecimal(salarioBruto),
      descontos: [],
      adicionais: [],
      totalDescontos: '0.00',
      totalAdicionais: '0.00',
      salarioLiquido: formatarDecimal(salarioLiquido),
    });
  }

  regrasAtivas.forEach((regra) => {
    if (!['DESCONTO', 'ADICIONAL'].includes(regra.natureza)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Regra de desconto/adicional inválida (${regra.tipo}). Natureza não reconhecida.`);
    }

    let valorDaRegra = 0;

    if (regra.valor_fixo !== null && regra.valor_fixo !== undefined && regra.valor_fixo !== '') {
      valorDaRegra = Number(regra.valor_fixo);
    } else if (regra.percentual !== null && regra.percentual !== undefined && regra.percentual !== '') {
      const percentual = Number(regra.percentual);
      valorDaRegra = percentual >= 1 ? salarioBruto * (percentual / 100) : salarioBruto * percentual;
    } else {
      throw new ApiError(400, 'VALIDATION_ERROR', `Regra de desconto/adicional inválida (${regra.tipo}). Revise os valores da regra.`);
    }

    const item = {
      tipo: regra.tipo,
      descricao: regra.descricao,
      valor: formatarDecimal(arredondar(valorDaRegra)),
      natureza: regra.natureza,
    };

    if (regra.natureza === 'DESCONTO') {
      descontos.push(item);
      totalDescontos += arredondar(valorDaRegra);
    } else if (regra.natureza === 'ADICIONAL') {
      adicionais.push(item);
      totalAdicionais += arredondar(valorDaRegra);
    }
  });

  totalDescontos = arredondar(totalDescontos);
  totalAdicionais = arredondar(totalAdicionais);
  const salarioLiquido = arredondar(salarioBruto - totalDescontos + totalAdicionais);

  res.json({
    usuarioId: usuario.usuarioId,
    periodo: {
      inicio: dataInicio,
      fim: dataFim,
    },
    valorHora: formatarDecimal(usuario.valorHora),
    totalHorasNormais: formatarDecimal(horas.totalHorasNormais),
    totalHorasExtras: formatarDecimal(horas.totalHorasExtras),
    salarioBrutoNormal: formatarDecimal(salarioBrutoNormal),
    salarioBrutoExtra: formatarDecimal(salarioBrutoExtra),
    salarioBruto: formatarDecimal(salarioBruto),
    descontos,
    adicionais,
    totalDescontos: formatarDecimal(totalDescontos),
    totalAdicionais: formatarDecimal(totalAdicionais),
    salarioLiquido: formatarDecimal(salarioLiquido),
  });
}
