// Leadership Lab — as fontes de referência temática dos cenários.
//
// São indicações de ONDE o assunto é tratado, para o revisor técnico saber o que conferir. Nenhum
// trecho foi copiado e nenhum parâmetro foi extraído: os documentos não puderam ser consultados
// nesta versão. A norma brasileira, o procedimento do Grand Massif e a recomendação do fabricante
// prevalecem sempre; as referências internacionais são apenas apoio.
import type { FonteDeReferencia } from "./tipos.js";

const f = (id: string, nome: string): FonteDeReferencia => ({
  id,
  nome,
  uso: "referencia-tematica"
});

export const fontesDeReferencia = [
  f(
    "anvisa-rdc-63-2011",
    "ANVISA RDC 63/2011: boas práticas de funcionamento de serviços de saúde"
  ),
  f("anvisa-rdc-7-2010", "ANVISA RDC 7/2010: requisitos para unidades de terapia intensiva"),
  f("anvisa-rdc-15-2012", "ANVISA RDC 15/2012: processamento de produtos para saúde"),
  f("nr-10", "NR-10: segurança em instalações e serviços em eletricidade"),
  f("nr-13", "NR-13: caldeiras, vasos de pressão e tubulações"),
  f("nhs-htm-01-01", "NHS HTM 01-01: descontaminação de instrumentais cirúrgicos"),
  f("nhs-htm-02-01", "NHS HTM 02-01: redes de gases medicinais"),
  f("nhs-htm-03-01", "NHS HTM 03-01: ventilação especializada em edificações de saúde"),
  f("nhs-htm-04-01", "NHS HTM 04-01: segurança da água em edificações de saúde"),
  f("nhs-htm-05-01", "NHS HTM 05-01: gestão da segurança contra incêndio em saúde"),
  f("nhs-htm-05-03", "NHS HTM 05-03: provisões operacionais contra incêndio em saúde"),
  f("nhs-htm-06-01", "NHS HTM 06-01: suprimento e distribuição de energia elétrica"),
  f("nhs-htm-08-02", "NHS HTM 08-02: elevadores em edificações de saúde"),
  f("cdc-controle-ambiental", "CDC: controle ambiental de infecções em serviços de saúde"),
  f("cdc-vacinas", "CDC: armazenamento e manuseio de vacinas"),
  f("cdc-agua-dialise", "CDC: água e dialisato em serviços de diálise"),
  f("oms-programas", "OMS: documentos de programas sobre tecnologias e infraestrutura de saúde")
] as const;

export const idsDeFontes: ReadonlySet<string> = new Set(fontesDeReferencia.map((x) => x.id));
