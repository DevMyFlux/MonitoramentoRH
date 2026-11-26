"""GET /saude/modelo: confirma credencial e modelo sem gerar conteúdo e sem expor detalhe da falha.
Uso: pytest services/lab-ia/tests/test_saude_do_modelo.py"""
import os
import sys
import types

import pytest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
os.environ["TOKEN_SERVICO"] = "teste"

try:  # sem o SDK do Gemini (máquina de desenvolvimento), um substituto vazio basta para importar
    import google.genai  # noqa: F401
except ImportError:  # pragma: no cover
    g, gen, tp = types.ModuleType("google"), types.ModuleType("google.genai"), types.ModuleType("google.genai.types")
    gen.types, gen.Client, g.genai = tp, object, gen
    for n in ("HttpOptions", "ThinkingConfig", "GenerateContentConfig"):
        setattr(tp, n, lambda **k: k)
    sys.modules.update({"google": g, "google.genai": gen, "google.genai.types": tp})

import agente  # noqa: E402
import main  # noqa: E402


def com_cliente(monkeypatch, obter):
    cliente = types.SimpleNamespace(models=types.SimpleNamespace(get=obter))
    monkeypatch.setattr(agente, "cliente", lambda: cliente)


def test_modelo_acessivel(monkeypatch):
    pedidos = []
    com_cliente(monkeypatch, lambda model: pedidos.append(model))
    assert main.saude_do_modelo("teste") == {"ok": True, "modelo": agente.MODELO, "erro": None}
    assert pedidos == [agente.MODELO]


def test_falha_devolve_so_o_tipo_do_erro(monkeypatch):
    def falhar(model):
        raise PermissionError("detalhe interno com segredo")

    com_cliente(monkeypatch, falhar)
    resposta = main.saude_do_modelo("teste")
    assert resposta == {"ok": False, "modelo": agente.MODELO, "erro": "PermissionError"}


def test_exige_o_token_do_servico():
    with pytest.raises(main.HTTPException) as erro:
        main.saude_do_modelo("outro")
    assert erro.value.status_code == 401
