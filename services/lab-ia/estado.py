"""Estado de cada teste (situações, gabaritos, escolhas e respostas já dadas).

Em produção fica no Firestore, para o teste continuar certo se o Cloud Run reiniciar ou se outra
instância atender o turno seguinte. Sem LAB_IA_FIRESTORE (testes locais), fica na memória.
Nada aqui identifica o participante: o backend só envia nível, temas e escolhas.
"""

from __future__ import annotations

import copy
import os
import time
from typing import Any, Protocol


class Repositorio(Protocol):
    def ler(self, sessao_id: str) -> dict[str, Any] | None: ...
    def gravar(self, sessao_id: str, estado: dict[str, Any]) -> None: ...


class RepositorioEmMemoria:
    def __init__(self) -> None:
        self._dados: dict[str, dict[str, Any]] = {}

    # Cópias, como no Firestore: alterar o estado lido sem gravar não muda o guardado.
    def ler(self, sessao_id: str) -> dict[str, Any] | None:
        estado = self._dados.get(sessao_id)
        return copy.deepcopy(estado) if estado is not None else None

    def gravar(self, sessao_id: str, estado: dict[str, Any]) -> None:
        self._dados[sessao_id] = copy.deepcopy(estado)


class RepositorioFirestore:
    COLECAO = "lab_ia_sessoes"

    def __init__(self, banco: str) -> None:
        from google.cloud import firestore

        self._db = firestore.Client(project=os.environ.get("GOOGLE_CLOUD_PROJECT"), database=banco)

    def ler(self, sessao_id: str) -> dict[str, Any] | None:
        doc = self._db.collection(self.COLECAO).document(sessao_id).get()
        return doc.to_dict() if doc.exists else None

    def gravar(self, sessao_id: str, estado: dict[str, Any]) -> None:
        estado["atualizado_em"] = time.time()
        self._db.collection(self.COLECAO).document(sessao_id).set(estado)


def criar_repositorio() -> Repositorio:
    banco = os.environ.get("LAB_IA_FIRESTORE")
    return RepositorioFirestore(banco) if banco else RepositorioEmMemoria()
