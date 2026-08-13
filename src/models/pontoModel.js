import db from '../db.js';

export function buscarRegistrosPorPeriodo(usuarioId, dataInicio, dataFim) {
  const linhas = db
    .prepare(
      `SELECT
         data,
         entrada,
         saida_almoco AS saidaAlmoco,
         retorno_almoco AS retornoAlmoco,
         saida
       FROM registros_ponto
       WHERE usuario_id = ?
         AND data BETWEEN ? AND ?
       ORDER BY data`
    )
    .all(usuarioId, dataInicio, dataFim);

  return linhas;
}

// Model de leitura da tabela registros_ponto: busca as marcações de ponto
// de um usuário dentro de um período de datas, para serem usadas pelo
// calculoHorasService.