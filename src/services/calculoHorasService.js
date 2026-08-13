const MS_POR_HORA = 1000 * 60 * 60;

function combinarDataHora(data, horario) {
  if (!horario) {
    return null;
  }

  const jaTemData = horario.includes('-') && horario.includes('T');
  const textoCompleto = jaTemData ? horario : `${data}T${horario}`;

  const dataConvertida = new Date(textoCompleto);

  if (Number.isNaN(dataConvertida.getTime())) {
    return null;
  }

  return dataConvertida;
}

function diferencaEmHoras(inicio, fim) {
  const diferencaEmMs = fim.getTime() - inicio.getTime();
  return diferencaEmMs / MS_POR_HORA;
}

function arredondar(numero) {
  return Math.round(numero * 100) / 100;
}

export function calcularHorasDoDia(registro, cargaHorariaDiaria) {
  const { data, entrada, saidaAlmoco, retornoAlmoco, saida } = registro;

  const registroCompleto = Boolean(entrada) && Boolean(saidaAlmoco) && Boolean(retornoAlmoco) && Boolean(saida);

  if (!registroCompleto) {
    return {
      data: data,
      horasTrabalhadas: null,
      horasNormais: 0,
      horasExtras: 0,
      completo: false,
    };
  }

  const horaEntrada = combinarDataHora(data, entrada);
  const horaSaidaAlmoco = combinarDataHora(data, saidaAlmoco);
  const horaRetornoAlmoco = combinarDataHora(data, retornoAlmoco);
  const horaSaida = combinarDataHora(data, saida);

  const periodoDaManha = diferencaEmHoras(horaEntrada, horaSaidaAlmoco);
  const periodoDaTarde = diferencaEmHoras(horaRetornoAlmoco, horaSaida);
  const horasTrabalhadas = arredondar(periodoDaManha + periodoDaTarde);

  const horasNormais = arredondar(Math.min(horasTrabalhadas, cargaHorariaDiaria));
  const horasExtras = arredondar(Math.max(horasTrabalhadas - cargaHorariaDiaria, 0));

  return {
    data: data,
    horasTrabalhadas: horasTrabalhadas,
    horasNormais: horasNormais,
    horasExtras: horasExtras,
    completo: true,
  };
}

export function calcularResumoPeriodo(registros, cargaHorariaDiaria) {
  const detalhePorDia = registros.map(function (registro) {
    return calcularHorasDoDia(registro, cargaHorariaDiaria);
  });

  let diasComRegistroCompleto = 0;
  let diasIncompletos = 0;
  let totalHorasNormais = 0;
  let totalHorasExtras = 0;

  for (const dia of detalhePorDia) {
    if (dia.completo) {
      diasComRegistroCompleto = diasComRegistroCompleto + 1;
    } else {
      diasIncompletos = diasIncompletos + 1;
    }

    totalHorasNormais = totalHorasNormais + dia.horasNormais;
    totalHorasExtras = totalHorasExtras + dia.horasExtras;
  }

  return {
    diasComRegistroCompleto: diasComRegistroCompleto,
    diasIncompletos: diasIncompletos,
    totalHorasNormais: arredondar(totalHorasNormais),
    totalHorasExtras: arredondar(totalHorasExtras),
    detalhePorDia: detalhePorDia,
  };
}

// Módulo puro (sem Express, sem banco de dados): recebe um registro de ponto
// e a carga horária diária do usuário, e devolve horas trabalhadas, normais
// e extras, seguindo as regras de negócio da task. 