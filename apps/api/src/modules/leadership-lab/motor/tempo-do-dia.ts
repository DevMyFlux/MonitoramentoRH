// "Hoje", para o limite diário de testes, é o dia no fuso da operação, não em UTC: um teste
// feito às 22h em São Paulo é do mesmo dia mesmo já sendo o dia seguinte em UTC.

/** Quanto o relógio local do fuso está à frente de UTC em `instante`, em ms. */
function deslocamentoDoFuso(instante: Date, fuso: string): number {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
      .formatToParts(instante)
      .map((p) => [p.type, p.value])
  );
  const comoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second)
  );
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/** O instante (UTC) em que começou o dia de `agora` no fuso informado. */
export function inicioDoDia(agora: Date, fuso: string): Date {
  const [ano, mes, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(agora)
    .split("-")
    .map(Number) as [number, number, number];

  const meiaNoiteComoUtc = Date.UTC(ano, mes - 1, dia);
  let candidato = meiaNoiteComoUtc - deslocamentoDoFuso(new Date(meiaNoiteComoUtc), fuso);
  // O deslocamento pode mudar entre o palpite e a meia-noite local (horário de verão).
  candidato = meiaNoiteComoUtc - deslocamentoDoFuso(new Date(candidato), fuso);
  return new Date(candidato);
}
