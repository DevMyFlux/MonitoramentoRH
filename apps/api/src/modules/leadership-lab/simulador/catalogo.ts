// Leadership Lab — o catálogo da biblioteca de simulações locais.
//
// Reúne os temas e seus cenários. A ordem do array é a ordem em que os temas aparecem para o
// participante. Acrescentar um tema é criar o arquivo em cenarios/ e listá-lo aqui; os testes
// validam todos os cenários listados.
import type { LabMoldeNivel } from "@my-flux/shared";
import { autoclavesCme } from "./cenarios/autoclaves-cme.js";
import { climatizacaoVentilacao } from "./cenarios/climatizacao-ventilacao.js";
import { compressoresVacuo } from "./cenarios/compressores-vacuo.js";
import { geradoresTransferencia } from "./cenarios/geradores-transferencia.js";
import { elevadores } from "./cenarios/elevadores.js";
import { gasesMedicinaisAlarmes } from "./cenarios/gases-medicinais-alarmes.js";
import { equipamentosMedicos } from "./cenarios/equipamentos-medicos.js";
import { hemodialiseAgua } from "./cenarios/hemodialise-agua.js";
import { incendioAlarme } from "./cenarios/incendio-alarme.js";
import { quadrosEletricos } from "./cenarios/quadros-eletricos.js";
import { refrigeracaoCadeiaFrio } from "./cenarios/refrigeracao-cadeia-frio.js";
import { reservatoriosAgua } from "./cenarios/reservatorios-agua.js";
import type { CategoriaDaBiblioteca, CenarioDaBiblioteca, PacoteDaCategoria } from "./tipos.js";

export const pacotesDaBiblioteca: readonly PacoteDaCategoria[] = [
  climatizacaoVentilacao,
  gasesMedicinaisAlarmes,
  compressoresVacuo,
  quadrosEletricos,
  geradoresTransferencia,
  autoclavesCme,
  incendioAlarme,
  reservatoriosAgua,
  elevadores,
  refrigeracaoCadeiaFrio,
  hemodialiseAgua,
  equipamentosMedicos
];

export const categoriasDaBiblioteca: readonly CategoriaDaBiblioteca[] = pacotesDaBiblioteca.map(
  (p) => p.categoria
);

export const idsDasCategorias: ReadonlySet<string> = new Set(
  categoriasDaBiblioteca.map((c) => c.id)
);

export function categoriaDa(id: string): CategoriaDaBiblioteca | undefined {
  return categoriasDaBiblioteca.find((c) => c.id === id);
}

/** O cenário do tema para o cargo, ou nulo se o tema não existe ou não vale para o cargo. */
export function cenarioDe(categoriaId: string, nivel: LabMoldeNivel): CenarioDaBiblioteca | null {
  const cenario = pacotesDaBiblioteca.find((p) => p.cenario.categoriaId === categoriaId)?.cenario;
  return cenario && cenario.niveis.includes(nivel) ? cenario : null;
}
