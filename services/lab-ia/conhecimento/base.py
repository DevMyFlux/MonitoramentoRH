"""A base de conhecimento (RAG): carga validada das fichas e recuperação por palavras.

Por que recuperação lexical (BM25) e não embeddings: o corpus é pequeno e curado, a busca precisa ser
explicável e testável (qual ficha entrou e por quê), não custa chamada de modelo nem infraestrutura
nova, e os filtros por cargo, competência e tipo de fonte pesam mais do que a similaridade semântica.
Quando o corpus crescer, a interface (`Base.buscar`) permanece e o índice pode virar vetorial.

Segurança: o conteúdo das fichas entra no prompt como DADO (`formatar_para_prompt`), com os
delimitadores neutralizados, e a instrução do agente manda tratá-lo como informação, nunca como ordem.
"""

from __future__ import annotations

import json
import logging
import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

from pydantic import ValidationError

from .ficha import Ficha

log = logging.getLogger("lab-ia.conhecimento")

PASTA_DAS_FICHAS = Path(__file__).parent / "fichas"
K_PADRAO = 3
K_MAXIMO = 5
# Abaixo disto a ficha não tem relação suficiente com a consulta: melhor não citar nada.
PISO_DE_RELEVANCIA = 0.35

PESO_DO_TIPO = {"legislacao": 1.2, "norma_tecnica": 1.2, "recomendacao": 1.1, "material_educacional": 1.0}
BONUS_VALIDADA = 1.3
BONUS_POR_COMPETENCIA = 0.25

_STOP = frozenset(
    "a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre entre e ou "
    "que se como mais menos muito pouco ao aos ja nao sim eu voce voces ele ela eles elas meu minha "
    "seu sua isso isto esse essa este esta ser estar ter foi sao era qual quais quando onde porque".split()
)


def dobrar(texto: str) -> str:
    """Minúsculas e sem acentos: "Eletricidade" e "eletricidade" são a mesma palavra."""
    return "".join(c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn")


def tokens(texto: str) -> list[str]:
    """Palavras úteis do texto. Mantém números (NR-10 vira "nr" e "10") e descarta o que não distingue."""
    achados = re.findall(r"[a-z0-9]+", dobrar(texto))
    return [t for t in achados if t not in _STOP and (len(t) >= 3 or t.isdigit() or t == "nr")]


@dataclass(frozen=True)
class Achado:
    ficha: Ficha
    relevancia: float


class BaseInvalida(Exception):
    """Uma ficha fora das regras: a carga inteira é recusada, não pela metade."""


def _texto_indexado(f: Ficha) -> str:
    # O título pesa mais: aparece três vezes.
    return " ".join([f.titulo] * 3 + [f.id.replace("-", " "), f.assunto, f.categoria, f.instituicao, *f.pontos_chave])


class Base:
    def __init__(self, fichas: Sequence[Ficha]) -> None:
        ids = [f.id for f in fichas]
        if len(set(ids)) != len(ids):
            raise BaseInvalida("ids de ficha repetidos")
        self.fichas = {f.id: f for f in fichas}
        self._docs = {f.id: Counter(tokens(_texto_indexado(f))) for f in fichas}
        self._tamanho = {i: sum(c.values()) for i, c in self._docs.items()}
        self._media = (sum(self._tamanho.values()) / len(self._docs)) if self._docs else 0.0
        self._df: Counter[str] = Counter()
        for c in self._docs.values():
            self._df.update(c.keys())

    @property
    def disponivel(self) -> bool:
        return bool(self.fichas)

    def _bm25(self, consulta: Iterable[str], ficha_id: str, k1: float = 1.4, b: float = 0.75) -> float:
        doc, n = self._docs[ficha_id], len(self._docs)
        score = 0.0
        for t in set(consulta):
            f = doc.get(t, 0)
            if not f:
                continue
            idf = math.log(1 + (n - self._df[t] + 0.5) / (self._df[t] + 0.5))
            norma = 1 - b + b * (self._tamanho[ficha_id] / (self._media or 1))
            score += idf * (f * (k1 + 1)) / (f + k1 * norma)
        return score

    def buscar(
        self,
        consulta: str,
        *,
        cargo: str | None = None,
        competencias: Sequence[str] = (),
        k: int = K_PADRAO,
        incluir_ponteiros: bool = True,
        tipos: Sequence[str] | None = None,
    ) -> list[Achado]:
        """As melhores fichas para a consulta, já filtradas por cargo e tipo e ordenadas por relevância.

        Fichas de outro cargo nunca entram. Ponteiros de estudo só entram com `incluir_ponteiros`.
        A relevância soma o texto (BM25) e multiplica por confiança: ficha validada e fonte oficial
        pesam mais; cada competência pedida que a ficha cobre também.
        """
        if not self.disponivel:
            return []
        q = tokens(consulta)
        if not q:
            return []
        achados: list[Achado] = []
        for ficha in self.fichas.values():
            if cargo and ficha.cargos and cargo not in ficha.cargos:
                continue
            if tipos and ficha.tipo not in tipos:
                continue
            if ficha.ponteiro and not incluir_ponteiros:
                continue
            base = self._bm25(q, ficha.id)
            if base <= 0:
                continue
            casadas = len(set(competencias) & set(ficha.competencias))
            peso = PESO_DO_TIPO[ficha.tipo] * (BONUS_VALIDADA if ficha.validada else 1.0) * (1 + BONUS_POR_COMPETENCIA * casadas)
            achados.append(Achado(ficha, base * peso))
        achados.sort(key=lambda a: (-a.relevancia, a.ficha.id))
        return [a for a in achados if a.relevancia >= PISO_DE_RELEVANCIA][: max(1, min(k, K_MAXIMO))]


def carregar_fichas(pasta: Path = PASTA_DAS_FICHAS) -> list[Ficha]:
    fichas: list[Ficha] = []
    for arquivo in sorted(pasta.glob("*.json")):
        try:
            fichas.append(Ficha.model_validate(json.loads(arquivo.read_text(encoding="utf-8"))))
        except (ValidationError, json.JSONDecodeError) as erro:
            raise BaseInvalida(f"{arquivo.name}: {erro}") from erro
    return fichas


def carregar_base(pasta: Path = PASTA_DAS_FICHAS) -> Base:
    """A base, ou uma base VAZIA se a carga falhar (fallback): os agentes seguem sem fontes, dizem
    que não têm base e as situações ficam experimentais. Nunca derruba o serviço."""
    try:
        return Base(carregar_fichas(pasta))
    except Exception as erro:  # noqa: BLE001 - qualquer falha de carga vira base vazia, com log
        log.error("base de conhecimento indisponível: %s", erro)
        return Base([])


# ---------------------------------------------------------------------------
# O que vai para o prompt e para o participante
# ---------------------------------------------------------------------------


def _neutralizar(texto: str) -> str:
    """Tira o que poderia fechar ou abrir um bloco do prompt."""
    return re.sub(r"[<>]", "", texto).strip()


def formatar_para_prompt(achados: Sequence[Achado]) -> str:
    """As fontes como blocos de DADO. Ponteiros aparecem sem pontos-chave e marcados: servem para
    indicar estudo, não para afirmar nada."""
    if not achados:
        return "(nenhuma fonte recuperada)"
    blocos = []
    for a in achados:
        f = a.ficha
        marca = "ponteiro" if f.ponteiro else ("validada" if f.validada else "nao-validada")
        corpo = (
            "Somente referência para estudo; o conteúdo NÃO foi lido: não afirme nada sobre ele."
            if f.ponteiro
            else "\n".join(f"- {_neutralizar(p)}" for p in f.pontos_chave)
        )
        blocos.append(
            f'<fonte id="{f.id}" tipo="{f.tipo}" situacao="{marca}">\n'
            f"{_neutralizar(f.titulo)} — {_neutralizar(f.instituicao)}\n{corpo}\n</fonte>"
        )
    return "\n".join(blocos)


def citacoes(achados: Sequence[Achado], usados: Iterable[str]) -> list[dict[str, object]]:
    """O que o participante vê de cada fonte realmente usada. Só ids que FORAM recuperados: o modelo
    não consegue citar uma fonte que o serviço não lhe deu."""
    por_id = {a.ficha.id: a.ficha for a in achados}
    vistos: list[str] = []
    for i in usados:
        if i in por_id and i not in vistos:
            vistos.append(i)
    return [
        {
            "id": f.id,
            "titulo": f.titulo,
            "instituicao": f.instituicao,
            "tipo": f.tipo,
            "url": f.url,
            "validada": f.validada,
        }
        for f in (por_id[i] for i in vistos)
    ]


def fundamentacao(achados: Sequence[Achado], usados: Iterable[str]) -> str:
    """"validada" só se há fontes usadas e TODAS são fichas validadas com conteúdo extraído. Decisão
    do serviço, a partir do cadastro; o modelo não opina."""
    por_id = {a.ficha.id: a.ficha for a in achados}
    fichas = [por_id[i] for i in dict.fromkeys(usados) if i in por_id]
    ok = bool(fichas) and all(f.validada and f.conteudo_extraido for f in fichas)
    return "validada" if ok else "experimental"
