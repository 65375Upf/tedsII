import * as usuarioModel from '../models/usuarioModel.js';
import * as pontoModel from '../models/pontoModel.js';
import { calcularResumoPeriodo } from '../services/calculoHorasService.js';
import ApiError from '../errors/apiError.js';

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

function validarPeriodo(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) {
    throw new ApiError(400, 'VALIDATION_ERROR', "Os parâmetros 'dataInicio' e 'dataFim' são obrigatórios.");
  }

  if (!FORMATO_DATA.test(dataInicio) || !FORMATO_DATA.test(dataFim)) {
    throw new ApiError(400, 'VALIDATION_ERROR', "As datas devem estar no formato 'YYYY-MM-DD'.");
  }

  if (dataInicio > dataFim) {
    throw new ApiError(400, 'VALIDATION_ERROR', "'dataInicio' não pode ser depois de 'dataFim'.");
  }
}

function montarResumoDoUsuario(usuarioId, dataInicio, dataFim) {
  const usuario = usuarioModel.buscarPorId(usuarioId);

  if (!usuario) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');
  }

  if (!usuario.cargaHorariaDiaria) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Usuário não possui cargaHorariaDiaria cadastrada.');
  }

  const registros = pontoModel.buscarRegistrosPorPeriodo(usuarioId, dataInicio, dataFim);
  const resumo = calcularResumoPeriodo(registros, usuario.cargaHorariaDiaria);

  return {
    usuarioId: usuarioId,
    periodo: { inicio: dataInicio, fim: dataFim },
    diasComRegistroCompleto: resumo.diasComRegistroCompleto,
    diasIncompletos: resumo.diasIncompletos,
    totalHorasNormais: resumo.totalHorasNormais,
    totalHorasExtras: resumo.totalHorasExtras,
    detalhePorDia: resumo.detalhePorDia,
  };
}

export function resumoProprio(req, res) {
  const dataInicio = req.query.dataInicio;
  const dataFim = req.query.dataFim;

  validarPeriodo(dataInicio, dataFim);

  const resumo = montarResumoDoUsuario(req.usuario.sub, dataInicio, dataFim);
  res.json(resumo);
}

export function resumoPorId(req, res) {
  const usuarioId = Number(req.params.id);
  const dataInicio = req.query.dataInicio;
  const dataFim = req.query.dataFim;

  validarPeriodo(dataInicio, dataFim);

  const resumo = montarResumoDoUsuario(usuarioId, dataInicio, dataFim);
  res.json(resumo);
}

// Controllers dos endpoints GET /ponto/resumo-horas (próprio usuário) e
// GET /usuarios/:id/ponto/resumo-horas (consulta administrativa). Valida
// o período informado, busca os dados e delega o cálculo ao
// calculoHorasService.