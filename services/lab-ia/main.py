"""Serviço de IA do Leadership Lab (agente_lab + guarda + facilitador).

Rotas do contrato (docs/leadership-lab.md, "Contrato com o serviço de IA"):
  POST /teste/sessoes   {molde, temas, numero_situacoes} -> {sessao_id, ...turno da situação 1, uso}
  POST /teste/turnos    {sessao_id, numero, escolha, tempo_esgotado, texto_livre} -> {...turno, uso}
  POST /agentes/guarda  {texto} -> {decisao, texto, uso}
  POST /agentes/facilitador  {molde, mensagem, historico, resultado} -> {resposta, uso}

Toda chamada exige o cabeçalho X-Servico-Token igual a TOKEN_SERVICO (o LAB_IA_TOKEN do site).
"""

from __future__ import annotations

import hmac
import logging
import os
import uuid
from typing import Annotated, Any, Literal

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

import agente
from agente import Uso
from contrato import (
    MAX_SITUACOES,
    NIVEIS,
    SKILLS,
    ViolacaoDoContrato,
    _texto_ou_nulo,
    avaliacao_da_escolha,
    normalizar_conversa,
    normalizar_guarda,
    normalizar_resultado,
    normalizar_situacao,
    turno_de_resultado,
    turno_de_situacao,
)
from conhecimento import carregar_base, citacoes, formatar_para_prompt, fundamentacao
from contrato import dificuldade_alvo, normalizar_base
from estado import criar_repositorio

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
log = logging.getLogger("lab-ia")

TENTATIVAS = int(os.environ.get("LAB_IA_TENTATIVAS", "2"))

app = FastAPI(title="Leadership Lab · serviço de IA", docs_url=None, redoc_url=None, openapi_url=None)
repositorio = criar_repositorio()
# A base de conhecimento (RAG). Se a carga falhar vira uma base vazia: os agentes seguem sem fontes
# e as situações ficam experimentais. Trocável nos testes.
base = carregar_base()
FONTES_POR_CONSULTA = 3


def exigir_token(recebido: str | None) -> None:
    esperado = os.environ.get("TOKEN_SERVICO", "")
    # Sem token configurado o serviço recusa tudo: falha fechada, nunca aberto.
    if not esperado or not recebido or not hmac.compare_digest(recebido, esperado):
        raise HTTPException(status_code=401, detail="token de serviço inválido")


# ---------------------------------------------------------------------------
# Corpos das requisições (iguais aos schemas estritos do backend)
# ---------------------------------------------------------------------------


class Estrito(BaseModel):
    model_config = ConfigDict(extra="forbid")


SkillId = Literal[tuple(SKILLS)]  # type: ignore[valid-type]
Curto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)]


class NivelDaRubrica(Estrito):
    aderencia: Literal[100, 70, 40, 10]
    criterio: Curto


class ObservarNaRubrica(Estrito):
    skill: SkillId
    criterio: Curto


class RubricaDoContexto(Estrito):
    niveis: list[NivelDaRubrica] = Field(min_length=4, max_length=4)
    observar: list[ObservarNaRubrica] = Field(max_length=8)


class ProfundidadeTecnica(Estrito):
    skill: SkillId
    profundidade: Literal["nenhuma", "nocao", "aplicacao"]


class SkillDoPerfil(Estrito):
    skill: SkillId
    nivel: int = Field(ge=1, le=5)
    tendencia: Literal["subindo", "estavel", "caindo", "sem_base"]
    testes: int = Field(ge=1)
    provisorio: bool
    escolhas_fracas: int = Field(ge=0)
    recorrente: bool


class PerfilResumido(Estrito):
    testes_considerados: int = Field(ge=0)
    testes_provisorios: int = Field(ge=0)
    skills: list[SkillDoPerfil] = Field(max_length=5)


class ContextoPedagogico(Estrito):
    """O que o cargo cobra, a rubrica e o histórico resumido (sem identificação). Espelha
    contextoPedagogicoIaSchema no backend; a fonte única é packages/shared."""

    rubrica_versao: Curto
    responsabilidades: list[Curto] = Field(max_length=8)
    foco: list[SkillId] = Field(max_length=8)
    profundidade_tecnica: list[ProfundidadeTecnica] = Field(max_length=8)
    limite_tecnico: Curto
    rubrica: RubricaDoContexto
    dificuldade_base: Literal[1, 2, 3]
    perfil: PerfilResumido | None


class IniciarSessao(Estrito):
    molde: Literal["encarregado", "supervisor", "coordenador"]
    temas: list[str] = Field(min_length=1)
    numero_situacoes: int = Field(ge=3, le=MAX_SITUACOES)
    # Opcional por compatibilidade com backends antigos: sem ele, o serviço se comporta como antes.
    contexto: ContextoPedagogico | None = None


class ProximoTurno(Estrito):
    sessao_id: str = Field(min_length=1)
    numero: int = Field(ge=1, le=MAX_SITUACOES)
    escolha: Literal["A", "B", "C"] | None
    tempo_esgotado: bool
    texto_livre: str | None


class Guarda(Estrito):
    texto: str = Field(min_length=1)


# O facilitador: espelha conversaIaRequestSchema (apps/api/.../ia/ia-contrato.ts). Os limites são os de
# labConversaLimites (packages/shared). Sem nome, aderência, tempos nem ids: lista fechada de campos.
Letra = Literal["A", "B", "C"]
TextoNaoVazio = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class OpcaoDaConversa(Estrito):
    id: Letra
    texto: TextoNaoVazio


class SituacaoDaConversa(Estrito):
    numero: int = Field(ge=1, le=MAX_SITUACOES)
    marco: bool
    texto: TextoNaoVazio
    opcoes: list[OpcaoDaConversa] = Field(min_length=3, max_length=3)
    escolha: Letra | None
    tempo_esgotado: bool
    justificativa: TextoNaoVazio | None


class SkillDaConversa(Estrito):
    skill: SkillId
    nivel: int = Field(ge=1, le=5)


class ResultadoDaConversa(Estrito):
    resumo: TextoNaoVazio
    ponto_forte: TextoNaoVazio | None
    ponto_desenvolvimento: TextoNaoVazio | None
    sugestoes: list[TextoNaoVazio]
    skills: list[SkillDaConversa]
    situacoes: list[SituacaoDaConversa] = Field(min_length=1, max_length=MAX_SITUACOES)


class MensagemDaConversa(Estrito):
    papel: Literal["participante", "facilitador"]
    texto: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1200)]


class Conversa(Estrito):
    modo: Literal["debriefing", "aprendizagem"]
    molde: Literal["encarregado", "supervisor", "coordenador"]
    mensagem: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
    historico: list[MensagemDaConversa] = Field(max_length=6)
    resultado: ResultadoDaConversa | None
    contexto: ContextoPedagogico | None

    @model_validator(mode="after")
    def _modo_coerente(self) -> "Conversa":
        if self.modo == "debriefing" and self.resultado is None:
            raise ValueError("o debriefing exige o resultado")
        if self.modo == "aprendizagem" and (self.resultado is not None or self.contexto is None):
            raise ValueError("a aprendizagem exige o contexto e não tem resultado")
        return self


# ---------------------------------------------------------------------------
# Geração com retentativa: o que fugir do contrato é refeito, nunca enviado
# ---------------------------------------------------------------------------


def _com_retentativa(gerar, pedido: str, uso: Uso):
    problemas: list[str] = []
    for tentativa in range(1, TENTATIVAS + 1):
        texto = pedido if not problemas else f"{pedido}\n\nA resposta anterior foi recusada: {'; '.join(problemas)}. Corrija."
        try:
            return gerar(texto)
        except (ViolacaoDoContrato, ValueError, KeyError, TypeError) as erro:
            problemas = [str(erro)]
            log.warning("tentativa %s recusada: %s", tentativa, erro)
        except Exception as erro:  # falha do Vertex AI (cota, rede, modelo): não adianta repetir já
            log.error("falha ao chamar o modelo: %s", erro)
            raise HTTPException(status_code=502, detail="falha ao chamar o modelo de IA") from erro
    raise HTTPException(status_code=502, detail=f"a IA não produziu um turno válido: {problemas[0]}")


def _recuperar(consulta: str, cargo: str, competencias: list[str]):
    """Busca na base. Qualquer falha vira "sem fontes": o agente segue e a situação fica experimental."""
    try:
        return base.buscar(consulta, cargo=cargo, competencias=competencias, k=FONTES_POR_CONSULTA)
    except Exception as erro:  # noqa: BLE001
        log.error("busca na base de conhecimento falhou: %s", erro)
        return []


def _nova_situacao(estado: dict[str, Any], numero: int, ultima: dict[str, Any] | None, texto_livre: str | None, uso: Uso):
    contexto = estado.get("contexto")
    achados, alvo = [], None
    if contexto:
        consulta, competencias = agente.consulta_de_treino(estado, numero)
        achados = _recuperar(consulta, estado["molde"], competencias)
        alvo = dificuldade_alvo(numero, estado["total"], contexto["dificuldade_base"])
    pedido = agente.pedido_de_situacao(
        estado, numero, ultima, texto_livre, fontes=formatar_para_prompt(achados), dificuldade=alvo
    )

    def gerar(texto: str):
        bruto = agente.gerar_json(agente.INSTRUCAO_LAB, agente.ESQUEMA_SITUACAO, texto, uso)
        situacao_bruta = bruto.get("situacao") or {}
        nova = normalizar_situacao(situacao_bruta, numero)
        if contexto:
            base_bruta = situacao_bruta.get("base") or {}
            usadas = [i for i in (base_bruta.get("fontes_usadas") or []) if isinstance(i, str)]
            nova["publica"]["base"] = normalizar_base(
                base_bruta, alvo, [a.ficha.id for a in achados], fundamentacao(achados, usadas)
            )
        consequencia = _texto_ou_nulo(bruto.get("consequencia"))
        if ultima is not None and consequencia is None:
            raise ViolacaoDoContrato("consequencia: obrigatória a partir da segunda situação")
        return nova, consequencia, _texto_ou_nulo(bruto.get("contribuicao"))

    return _com_retentativa(gerar, pedido, uso)


def _fechamento(estado: dict[str, Any], texto_livre: str | None, uso: Uso):
    pedido = agente.pedido_de_resultado(estado, texto_livre)

    def gerar(texto: str):
        bruto = agente.gerar_json(agente.INSTRUCAO_LAB, agente.ESQUEMA_RESULTADO, texto, uso, temperatura=0.5)
        # Contribuição do último turno só existe se o gestor escreveu algo.
        contribuicao = _texto_ou_nulo(bruto.get("contribuicao")) if texto_livre else None
        contribuicoes = [c for c in estado.get("contribuicoes", []) if c] + ([contribuicao] if contribuicao else [])
        resultado = normalizar_resultado(bruto.get("resultado") or {}, contribuicoes)
        consequencia = _texto_ou_nulo(bruto.get("consequencia")) or "O teste terminou com esta decisão."
        return resultado, consequencia, contribuicao

    return _com_retentativa(gerar, pedido, uso)


# ---------------------------------------------------------------------------
# Rotas
# ---------------------------------------------------------------------------


@app.get("/")
def saude() -> dict[str, str]:
    return {"servico": "lab-ia", "status": "ok", "modelo": agente.MODELO, "versao_instrucao": agente.VERSAO_INSTRUCAO}


@app.post("/teste/sessoes")
def abrir_sessao(corpo: IniciarSessao, x_servico_token: str | None = Header(default=None)) -> dict[str, Any]:
    exigir_token(x_servico_token)
    sessao_id = f"lab.{uuid.uuid4().hex}"
    estado: dict[str, Any] = {
        "molde": corpo.molde,
        "temas": [t.strip() for t in corpo.temas if t.strip()],
        "total": corpo.numero_situacoes,
        "historico": [],
        "contribuicoes": [],
        "respostas": {},
        "concluida": False,
        # O contexto fica no estado: os turnos seguintes usam o mesmo cargo, rubrica e perfil.
        "contexto": corpo.contexto.model_dump() if corpo.contexto else None,
    }
    uso = Uso()
    nova, _, _ = _nova_situacao(estado, 1, None, None, uso)
    estado["historico"].append({"situacao": nova["publica"], "gabarito": nova["gabarito"], "rota": nova["rota"], "respondida": False, "base": nova["publica"].get("base")})
    repositorio.gravar(sessao_id, estado)
    log.info("sessao aberta molde=%s total=%s rota=%s", corpo.molde, corpo.numero_situacoes, nova["rota"])
    return {"sessao_id": sessao_id, **turno_de_situacao(None, None, nova["publica"], uso.bloco("agente_lab"))}


@app.post("/teste/turnos")
def proximo_turno(corpo: ProximoTurno, x_servico_token: str | None = Header(default=None)) -> dict[str, Any]:
    exigir_token(x_servico_token)
    if corpo.tempo_esgotado != (corpo.escolha is None):
        raise HTTPException(status_code=400, detail="tempo esgotado e ausência de escolha andam juntos")
    estado = repositorio.ler(corpo.sessao_id)
    if estado is None:
        raise HTTPException(status_code=404, detail="sessão desconhecida")

    # Reenvio do mesmo turno (rede, retentativa do backend): devolve a mesma resposta.
    ja_dada = estado["respostas"].get(str(corpo.numero))
    if ja_dada is not None:
        return ja_dada

    pendente = estado["historico"][-1]
    if pendente.get("respondida") or pendente["situacao"]["numero"] != corpo.numero:
        raise HTTPException(status_code=409, detail=f"a situação pendente é a {pendente['situacao']['numero']}")

    pendente["escolha"] = corpo.escolha
    pendente["respondida"] = True
    texto_livre = None if corpo.escolha is None else _texto_ou_nulo(corpo.texto_livre)
    uso = Uso()

    if corpo.numero < estado["total"]:
        nova, consequencia, contribuicao = _nova_situacao(estado, corpo.numero + 1, pendente, texto_livre, uso)
        contribuicao = contribuicao if texto_livre else None
        avaliacao = avaliacao_da_escolha(corpo.numero, corpo.escolha, pendente["gabarito"], contribuicao)
        estado["historico"].append({"situacao": nova["publica"], "gabarito": nova["gabarito"], "rota": nova["rota"], "respondida": False, "base": nova["publica"].get("base")})
        resposta = turno_de_situacao(avaliacao, consequencia, nova["publica"], uso.bloco("agente_lab"))
    else:
        resultado, consequencia, contribuicao = _fechamento(estado, texto_livre, uso)
        avaliacao = avaliacao_da_escolha(corpo.numero, corpo.escolha, pendente["gabarito"], contribuicao)
        estado["concluida"] = True
        resposta = turno_de_resultado(avaliacao, consequencia, resultado, uso.bloco("agente_lab"))

    if avaliacao["contribuicao"]:
        estado["contribuicoes"].append(avaliacao["contribuicao"])
    estado["respostas"][str(corpo.numero)] = resposta
    repositorio.gravar(corpo.sessao_id, estado)
    return resposta


@app.post("/agentes/guarda")
def guarda(corpo: Guarda, x_servico_token: str | None = Header(default=None)) -> dict[str, Any]:
    exigir_token(x_servico_token)
    uso = Uso()
    try:
        bruto = agente.gerar_json(
            agente.INSTRUCAO_GUARDA, agente.ESQUEMA_GUARDA, corpo.texto, uso, temperatura=0.0, raciocinio="MINIMAL"
        )
        decisao, texto = normalizar_guarda(bruto, corpo.texto)
    except Exception as erro:  # o backend trata qualquer falha como bloqueio
        log.warning("guarda falhou: %s", erro)
        decisao, texto = "bloquear", None
    return {"decisao": decisao, "texto": texto, "uso": uso.bloco("guarda")}


@app.post("/agentes/facilitador")
def facilitador(corpo: Conversa, x_servico_token: str | None = Header(default=None)) -> dict[str, Any]:
    """Responde uma dúvida: sobre o resultado já concluído (debriefing) ou de aprendizagem, fora de
    qualquer teste. Sem estado: nada da conversa é guardado aqui. O backend nunca chama o modo
    aprendizagem durante um teste em andamento."""
    exigir_token(x_servico_token)
    uso = Uso()
    dados = corpo.model_dump()
    consulta, competencias = agente.consulta_de_conversa(dados)
    achados = _recuperar(consulta, corpo.molde, competencias)
    pedido = agente.pedido_de_conversa(dados, formatar_para_prompt(achados))

    def gerar(texto: str):
        bruto = agente.gerar_json(
            agente.INSTRUCAO_FACILITADOR, agente.ESQUEMA_CONVERSA, texto, uso, temperatura=0.4
        )
        usadas = [i for i in (bruto.get("fontes_usadas") or []) if isinstance(i, str)]
        return normalizar_conversa(bruto), citacoes(achados, usadas)

    resposta, fontes = _com_retentativa(gerar, pedido, uso)
    return {"resposta": resposta, "fontes": fontes, "uso": uso.bloco("facilitador")}


__all__ = ["app", "NIVEIS"]
