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
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

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
from estado import criar_repositorio

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
log = logging.getLogger("lab-ia")

TENTATIVAS = int(os.environ.get("LAB_IA_TENTATIVAS", "2"))

app = FastAPI(title="Leadership Lab · serviço de IA", docs_url=None, redoc_url=None, openapi_url=None)
repositorio = criar_repositorio()


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


class IniciarSessao(Estrito):
    molde: Literal["encarregado", "supervisor", "coordenador"]
    temas: list[str] = Field(min_length=1)
    numero_situacoes: int = Field(ge=3, le=MAX_SITUACOES)


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
    skill: Literal[tuple(SKILLS)]  # type: ignore[valid-type]
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
    molde: Literal["encarregado", "supervisor", "coordenador"]
    mensagem: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
    historico: list[MensagemDaConversa] = Field(max_length=6)
    resultado: ResultadoDaConversa


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


def _nova_situacao(estado: dict[str, Any], numero: int, ultima: dict[str, Any] | None, texto_livre: str | None, uso: Uso):
    pedido = agente.pedido_de_situacao(estado, numero, ultima, texto_livre)

    def gerar(texto: str):
        bruto = agente.gerar_json(agente.INSTRUCAO_LAB, agente.ESQUEMA_SITUACAO, texto, uso)
        nova = normalizar_situacao(bruto.get("situacao") or {}, numero)
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
    }
    uso = Uso()
    nova, _, _ = _nova_situacao(estado, 1, None, None, uso)
    estado["historico"].append({"situacao": nova["publica"], "gabarito": nova["gabarito"], "rota": nova["rota"], "respondida": False})
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
        estado["historico"].append({"situacao": nova["publica"], "gabarito": nova["gabarito"], "rota": nova["rota"], "respondida": False})
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
    """Responde uma dúvida sobre o resultado já concluído. Sem estado: nada da conversa é guardado aqui."""
    exigir_token(x_servico_token)
    uso = Uso()
    pedido = agente.pedido_de_conversa(corpo.model_dump())

    def gerar(texto: str) -> str:
        bruto = agente.gerar_json(
            agente.INSTRUCAO_FACILITADOR, agente.ESQUEMA_CONVERSA, texto, uso, temperatura=0.4
        )
        return normalizar_conversa(bruto)

    resposta = _com_retentativa(gerar, pedido, uso)
    return {"resposta": resposta, "uso": uso.bloco("facilitador")}


__all__ = ["app", "NIVEIS"]
