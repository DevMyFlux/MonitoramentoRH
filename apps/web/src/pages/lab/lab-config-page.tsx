import {
  type LabCargoDoCadastro,
  type LabMoldeConfigurado,
  labTempoLimiteFaixaS
} from "@my-flux/shared";
import { useState } from "react";
import {
  Badge,
  Button,
  CabecalhoDePagina,
  Escalonar,
  Input,
  LoadingState,
  Revelar
} from "../../features/leadership-lab/ui";
import { ErroDaTelaDoLab } from "../../features/leadership-lab/componentes/erro-da-tela";
import {
  useAtualizarMolde,
  useConfigDosMoldes
} from "../../features/leadership-lab/cadastro-hooks";
import { descreverErroDoCadastro } from "../../features/leadership-lab/erros";

export function LabConfigPage() {
  const config = useConfigDosMoldes();

  return (
    <Escalonar className="space-y-8">
      <Revelar>
        <CabecalhoDePagina
          eyebrow="MY FLUX · Desenvolvimento"
          titulo="Configuração do Leadership Lab"
          descricao="Defina o tempo de cada situação, quais cargos usam cada teste e quando o teste é liberado para os participantes. Não há dados de pessoas nesta tela."
        />
      </Revelar>

      {config.isPending ? (
        <LoadingState />
      ) : config.isError ? (
        <ErroDaTelaDoLab
          erro={descreverErroDoCadastro(config.error, "configuracao")}
          aoTentarDeNovo={() => void config.refetch()}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {config.data.moldes.map((molde) => (
            <CartaoDoMolde key={molde.id} molde={molde} cargos={config.data.cargos} />
          ))}
        </div>
      )}
    </Escalonar>
  );
}

function CartaoDoMolde({
  molde,
  cargos
}: {
  molde: LabMoldeConfigurado;
  cargos: LabCargoDoCadastro[];
}) {
  const salvar = useAtualizarMolde();
  const [tempo, setTempo] = useState(molde.tempoLimiteS === null ? "" : String(molde.tempoLimiteS));
  const [ativo, setAtivo] = useState(molde.ativo);
  const [cargoIds, setCargoIds] = useState(() => new Set(molde.cargoIds));
  const [filtro, setFiltro] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const tempoTravado = molde.testesEmAndamento > 0;
  const tempoNumerico = tempo.trim() === "" ? null : Number(tempo);
  const mudou =
    tempoNumerico !== molde.tempoLimiteS ||
    ativo !== molde.ativo ||
    cargoIds.size !== molde.cargoIds.length ||
    molde.cargoIds.some((id) => !cargoIds.has(id));

  const filtrados = cargos.filter((c) =>
    c.nome.toLocaleLowerCase("pt-BR").includes(filtro.trim().toLocaleLowerCase("pt-BR"))
  );

  const enviar = () => {
    setSalvo(false);
    if (
      tempoNumerico !== null &&
      (!Number.isInteger(tempoNumerico) ||
        tempoNumerico < labTempoLimiteFaixaS.min ||
        tempoNumerico > labTempoLimiteFaixaS.max)
    ) {
      setAviso(
        `O tempo deve ser um número inteiro de segundos, de ${labTempoLimiteFaixaS.min} a ${labTempoLimiteFaixaS.max}.`
      );
      return;
    }
    if (ativo && tempoNumerico === null) {
      setAviso("Defina o tempo por situação para liberar o teste.");
      return;
    }
    setAviso(null);
    salvar.mutate(
      { nivel: molde.nivel, tempoLimiteS: tempoNumerico, ativo, cargoIds: [...cargoIds] },
      { onSuccess: () => setSalvo(true) }
    );
  };

  const alternarCargo = (id: string) =>
    setCargoIds((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  return (
    <form
      aria-label={`Molde ${molde.nome}`}
      // A validação é a da tela (mensagem em português, no cartão), não a do navegador.
      noValidate
      className="space-y-5 rounded-lab-lg border border-lab-linha bg-lab-superficie p-5 shadow-lab-1"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lab-corpo font-semibold text-lab-tinta">{molde.nome}</h2>
          <p className="mt-0.5 text-lab-legenda text-lab-tinta-2">
            {molde.numeroSituacoes} situações por teste
          </p>
        </div>
        <Badge tone={molde.ativo ? "success" : "neutral"}>
          {molde.ativo ? "Liberado" : "Não liberado"}
        </Badge>
      </header>

      {molde.temas.length > 0 ? (
        <div>
          <p className="text-lab-legenda font-medium text-lab-tinta-2">Temas do teste</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {molde.temas.map((tema) => (
              <li key={tema}>
                <Badge>{tema}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Input
        label="Tempo por situação (segundos)"
        name={`tempo-${molde.nivel}`}
        type="number"
        inputMode="numeric"
        min={labTempoLimiteFaixaS.min}
        max={labTempoLimiteFaixaS.max}
        step={1}
        value={tempo}
        disabled={tempoTravado}
        onChange={(e) => setTempo(e.target.value)}
        helperText={
          tempoTravado
            ? `Há ${molde.testesEmAndamento} ${molde.testesEmAndamento === 1 ? "teste em andamento" : "testes em andamento"}. O tempo só pode mudar quando terminarem.`
            : "Decisão do negócio: o sistema não sugere um valor."
        }
      />

      <label className="flex items-start gap-3 text-lab-pequeno text-lab-tinta">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[rgb(var(--lab-destaque))]"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
        />
        <span>
          <span className="font-medium">Teste liberado</span>
          <span className="block text-lab-legenda text-lab-tinta-2">
            Só os participantes dos cargos abaixo conseguem iniciar. Exige o tempo definido.
          </span>
        </span>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-lab-pequeno font-medium text-lab-tinta">
          Cargos que usam este teste
        </legend>
        <Input
          label="Filtrar cargos"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          autoComplete="off"
        />
        <ul className="max-h-60 space-y-1 overflow-y-auto rounded-lab-md border border-lab-linha p-2">
          {filtrados.length === 0 ? (
            <li className="p-2 text-lab-legenda text-lab-tinta-2">Nenhum cargo encontrado.</li>
          ) : (
            filtrados.map((cargo) => {
              const emOutro = cargo.moldeNivel !== null && cargo.moldeNivel !== molde.nivel;
              return (
                <li key={cargo.id}>
                  <label className="flex items-start gap-2 rounded-lab-sm p-1.5 text-lab-pequeno text-lab-tinta hover:bg-lab-superficie-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[rgb(var(--lab-destaque))]"
                      checked={cargoIds.has(cargo.id)}
                      disabled={emOutro}
                      onChange={() => alternarCargo(cargo.id)}
                    />
                    <span>
                      {cargo.nome}
                      {emOutro ? (
                        <span className="block text-lab-legenda text-lab-tinta-2">
                          Já usa outro teste. Tire-o de lá para usar neste.
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })
          )}
        </ul>
        <p className="text-lab-legenda text-lab-tinta-2">
          {cargoIds.size} {cargoIds.size === 1 ? "cargo selecionado" : "cargos selecionados"}
        </p>
      </fieldset>

      {aviso ? (
        <p
          role="alert"
          className="rounded-lab-md bg-lab-perigo-suave p-3 text-lab-pequeno text-lab-perigo-texto"
        >
          {aviso}
        </p>
      ) : null}
      {salvar.isError ? (
        <p
          role="alert"
          className="rounded-lab-md bg-lab-perigo-suave p-3 text-lab-pequeno text-lab-perigo-texto"
        >
          {descreverErroDoCadastro(salvar.error, "configuracao").descricao}
        </p>
      ) : null}
      {salvo ? (
        <p role="status" className="text-lab-pequeno text-lab-destaque-texto">
          Alterações salvas.
        </p>
      ) : null}

      <Button type="submit" disabled={!mudou || salvar.isPending}>
        {salvar.isPending ? "Salvando..." : `Salvar ${molde.nome}`}
      </Button>
    </form>
  );
}
