"""Regras do contrato com o backend (apps/api/src/modules/leadership-lab/ia/ia-contrato.ts).

O backend valida tudo o que volta daqui e recusa o que fugir do contrato. Este módulo aplica as
mesmas regras ANTES de responder, em código, para que uma resposta do modelo fora da regra nunca
chegue ao backend: o que dá para corrigir sem mudar o sentido (ordem das opções, alerta derivado
da aderência, skills repetidas) é corrigido; o que não dá vira erro e o turno é refeito.
"""

from __future__ import annotations

from typing import Any

ESCOLHAS = ("A", "B", "C")
ESTILOS = ("direcao", "orientacao", "apoio", "delegacao")
ADERENCIAS_DE_ESCOLHA = (100, 70, 40, 10)  # 0 só existe sem escolha (tempo esgotado)
SITUACAO_DO_MARCO = 3
MAX_SITUACOES = 10
NIVEIS = ("encarregado", "supervisor", "coordenador")

# packages/shared/src/leadership-lab.ts — labSkillsPiloto
SKILLS = {
    "aplicacao-nr-pop": "Aplicação de NR e POP",
    "gestao-os": "Gestão de OS e prioridades",
    "contingencia": "Plano de contingência",
    "materiais-custos": "Gestão de materiais e custos",
    "comunicacao-cliente": "Comunicação com o cliente",
    "gestao-equipe": "Gestão de equipe e conflitos",
    "decisao-pressao": "Decisão sob pressão",
    "delegacao": "Delegação e desenvolvimento do time",
}


class ViolacaoDoContrato(ValueError):
    """A resposta do modelo não pode ser aproveitada sem mudar o sentido: refazer o turno."""


def _texto(valor: Any, campo: str) -> str:
    if not isinstance(valor, str) or not valor.strip():
        raise ViolacaoDoContrato(f"{campo}: texto vazio")
    return valor.strip()


def _texto_ou_nulo(valor: Any) -> str | None:
    if isinstance(valor, str) and valor.strip():
        return valor.strip()
    return None


def _skills(valor: Any) -> list[str]:
    vistas: list[str] = []
    for s in valor if isinstance(valor, list) else []:
        if s in SKILLS and s not in vistas:
            vistas.append(s)
    return vistas


def normalizar_situacao(bruta: dict[str, Any], numero: int) -> dict[str, Any]:
    """Situação nova vinda do modelo, com o gabarito de cada opção.

    Devolve {"publica": <situação do contrato>, "gabarito": {A|B|C: avaliação}}. O gabarito
    nunca sai daqui: fica no estado da sessão e só vira `avaliacao_anterior` depois da escolha.
    """
    texto = _texto(bruta.get("texto"), "situacao.texto")
    estilo_adequado = bruta.get("estilo_adequado")
    if estilo_adequado not in ESTILOS:
        raise ViolacaoDoContrato(f"situacao.estilo_adequado inválido: {estilo_adequado!r}")

    por_letra = {}
    for opcao in bruta.get("opcoes") or []:
        letra = opcao.get("id") if isinstance(opcao, dict) else None
        if letra in ESCOLHAS and letra not in por_letra:
            por_letra[letra] = opcao
    if set(por_letra) != set(ESCOLHAS):
        raise ViolacaoDoContrato("situacao.opcoes: precisa de exatamente A, B e C")

    opcoes, gabarito = [], {}
    for letra in ESCOLHAS:
        o = por_letra[letra]
        aderencia = o.get("aderencia")
        if isinstance(aderencia, str) and aderencia.strip().isdigit():
            aderencia = int(aderencia.strip())  # o esquema do Gemini manda a nota como texto
        if aderencia not in ADERENCIAS_DE_ESCOLHA:
            raise ViolacaoDoContrato(f"opção {letra}: aderência {aderencia!r} fora da escala 100/70/40/10")
        estilo = o.get("estilo")
        opcoes.append({"id": letra, "texto": _texto(o.get("texto"), f"opção {letra}")})
        gabarito[letra] = {
            "aderencia": aderencia,
            "estilo": estilo if estilo in ESTILOS else None,
            "skills": _skills(o.get("skills")),
            "justificativa": _texto(o.get("justificativa"), f"opção {letra}.justificativa"),
        }
    if len({g["aderencia"] for g in gabarito.values()}) < 2:
        raise ViolacaoDoContrato("as três opções têm a mesma aderência: não há o que diferenciar")

    publica = {
        "numero": numero,
        "marco": numero == SITUACAO_DO_MARCO,
        "estilo_adequado": estilo_adequado,
        "texto": texto,
        "opcoes": opcoes,
    }
    return {"publica": publica, "gabarito": gabarito, "rota": bruta.get("rota")}


def avaliacao_da_escolha(
    numero: int, escolha: str | None, gabarito: dict[str, Any], contribuicao: str | None
) -> dict[str, Any]:
    """`avaliacao_anterior` do contrato, montada do gabarito guardado (nunca do modelo na hora)."""
    if escolha is None:
        # Tempo esgotado: omissão. Aderência 0, sem estilo, sem alerta, sem contribuição.
        return {
            "numero": numero,
            "escolha": None,
            "aderencia": 0,
            "estilo": None,
            "skills": [],
            "alerta": None,
            "contribuicao": None,
            "justificativa": "O tempo esgotou sem resposta: a situação ficou sem decisão do gestor.",
        }
    g = gabarito[escolha]
    return {
        "numero": numero,
        "escolha": escolha,
        "aderencia": g["aderencia"],
        "estilo": g["estilo"],
        "skills": g["skills"],
        "alerta": "vermelho" if g["aderencia"] == 10 else None,
        "contribuicao": contribuicao,
        "justificativa": g["justificativa"],
    }


def normalizar_resultado(bruto: dict[str, Any], contribuicoes: list[str]) -> dict[str, Any]:
    """Fechamento do teste. Só texto: os números são do backend."""
    sugestoes = [s.strip() for s in bruto.get("sugestoes") or [] if isinstance(s, str) and s.strip()]
    if not sugestoes:
        raise ViolacaoDoContrato("resultado.sugestoes: vazio")
    return {
        "resumo": _texto(bruto.get("resumo"), "resultado.resumo"),
        "ponto_forte": _texto(bruto.get("ponto_forte"), "resultado.ponto_forte"),
        "ponto_desenvolvimento": _texto(bruto.get("ponto_desenvolvimento"), "resultado.ponto_desenvolvimento"),
        "sugestoes": sugestoes,
        "contribuicoes": contribuicoes,
    }


def turno_de_situacao(
    avaliacao: dict[str, Any] | None, consequencia: str | None, situacao: dict[str, Any], uso: dict[str, Any]
) -> dict[str, Any]:
    return {
        "tipo": "situacao",
        "avaliacao_anterior": avaliacao,
        "consequencia": consequencia,
        "situacao": situacao,
        "resultado": None,
        "uso": uso,
    }


def turno_de_resultado(
    avaliacao: dict[str, Any], consequencia: str | None, resultado: dict[str, Any], uso: dict[str, Any]
) -> dict[str, Any]:
    return {
        "tipo": "resultado",
        "avaliacao_anterior": avaliacao,
        "consequencia": consequencia,
        "situacao": None,
        "resultado": resultado,
        "uso": uso,
    }


def normalizar_guarda(bruta: dict[str, Any], original: str) -> tuple[str, str | None]:
    """(decisão, texto). Na dúvida, bloqueia: o backend também falha fechado."""
    decisao = bruta.get("decisao")
    if decisao == "seguir":
        return "seguir", None
    if decisao == "mascarar":
        mascarado = _texto_ou_nulo(bruta.get("texto"))
        if mascarado and mascarado != original:
            return "mascarar", mascarado
        return "bloquear", None
    return "bloquear", None


__all__ = [
    "ESCOLHAS",
    "ESTILOS",
    "MAX_SITUACOES",
    "NIVEIS",
    "SKILLS",
    "SITUACAO_DO_MARCO",
    "ViolacaoDoContrato",
    "avaliacao_da_escolha",
    "normalizar_guarda",
    "normalizar_resultado",
    "normalizar_situacao",
    "turno_de_resultado",
    "turno_de_situacao",
    "_texto_ou_nulo",
]
