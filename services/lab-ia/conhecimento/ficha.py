"""A ficha da base de conhecimento: um documento de uma instituição, com os metadados que permitem
citá-lo, classificá-lo e saber o quanto confiar nele.

Regras (impostas na carga, não na boa vontade de quem cadastra):
  - `tipo` diferencia legislação, norma técnica, recomendação oficial e material educacional: nunca
    se trata material educacional como norma.
  - `pontos_chave` são sínteses ORIGINAIS e curtas (direitos autorais: nada de trechos extensos).
  - `conteudo_extraido` falso = "ponteiro de estudo": o documento é conhecido e citável, mas o seu
    conteúdo ainda não foi lido para a base. Um ponteiro nunca sustenta uma afirmação.
  - `validada` (validação técnica do negócio) só é possível com conteúdo extraído, URL e data de
    verificação. Conteúdo que influencia avaliação oficial exige `validada`.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

TipoDeFonte = Literal["legislacao", "norma_tecnica", "recomendacao", "material_educacional"]
Cargo = Literal["encarregado", "supervisor", "coordenador"]

Slug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9][a-z0-9-]{2,63}$")]
Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
# Uma síntese, não uma cópia: o limite por ponto impede colar parágrafos do documento.
PontoChave = Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=280)]
Data = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$")]

MAX_PONTOS_CHAVE = 6


class Ficha(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Slug
    titulo: Texto
    instituicao: Texto
    tipo: TipoDeFonte
    categoria: Texto
    assunto: Texto
    url: Annotated[str, StringConstraints(pattern=r"^https://\S+$")] | None = None
    versao: Texto | None = None
    publicado_em: Data | None = None
    atualizado_em: Data | None = None
    verificado_em: Data | None = None
    competencias: list[str] = Field(default_factory=list)
    cargos: list[Cargo] = Field(default_factory=list)  # vazio = todos os cargos
    conteudo_extraido: bool = False
    pontos_chave: list[PontoChave] = Field(default_factory=list, max_length=MAX_PONTOS_CHAVE)
    validada: bool = False
    observacoes: Texto | None = None

    @model_validator(mode="after")
    def _coerente(self) -> "Ficha":
        if self.conteudo_extraido and not self.pontos_chave:
            raise ValueError("conteudo_extraido exige ao menos um ponto-chave")
        if not self.conteudo_extraido and self.pontos_chave:
            raise ValueError("ponteiro de estudo (conteudo_extraido falso) não pode ter pontos-chave")
        if self.validada and not (self.conteudo_extraido and self.url and self.verificado_em):
            raise ValueError("validada exige conteudo_extraido, url e verificado_em")
        return self

    @property
    def ponteiro(self) -> bool:
        """Só aponta para o documento; não sustenta nenhuma afirmação."""
        return not self.conteudo_extraido
