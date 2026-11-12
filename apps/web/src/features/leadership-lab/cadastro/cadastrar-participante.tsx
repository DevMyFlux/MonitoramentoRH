import {
  type LabColaboradorDoCadastro,
  type LabUsuarioElegivel,
  labBuscaMinimaCaracteres
} from "@my-flux/shared";
import { useState } from "react";
import { Button, Input, Marcacao, MensagemDeErro, Modal, useNotificar } from "../ui";
import { cn } from "../../../lib/cn";
import {
  buscaValida,
  useCadastrarParticipante,
  useColaboradoresElegiveis,
  useUsuariosElegiveis,
  useValorComAtraso
} from "../cadastro-hooks";
import { descreverErroDoCadastro } from "../erros";
import { SeloDoMolde } from "./selo-do-molde";

type Props = { aberto: boolean; aoFechar: () => void };

/**
 * Liga um usuário de perfil comum a um colaborador. Duas buscas (a lista nunca vem inteira: o
 * servidor só responde a uma busca) e uma escolha em cada. O servidor confere de novo tudo: o
 * escopo do RH, a situação do colaborador e se a conta ainda está livre.
 */
export function CadastrarParticipante({ aberto, aoFechar }: Props) {
  // O conteúdo só existe com o modal aberto: fechar e abrir de novo começa do zero.
  return (
    <Modal
      isOpen={aberto}
      title="Cadastrar participante"
      description="Ligue o usuário de quem vai fazer os testes ao cadastro dele como colaborador."
      onClose={aoFechar}
    >
      <Formulario aoFechar={aoFechar} />
    </Modal>
  );
}

function Formulario({ aoFechar }: { aoFechar: () => void }) {
  const [buscaColaborador, setBuscaColaborador] = useState("");
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  const colaboradores = useColaboradoresElegiveis(useValorComAtraso(buscaColaborador));
  const usuarios = useUsuariosElegiveis(useValorComAtraso(buscaUsuario));
  const cadastrar = useCadastrarParticipante();
  const notificar = useNotificar();

  const enviar = () => {
    if (colaboradorId === null || usuarioId === null) return;
    cadastrar.mutate(
      { employeeId: colaboradorId, userId: usuarioId },
      {
        onSuccess: () => {
          notificar({ tom: "sucesso", titulo: "Participante cadastrado" });
          aoFechar();
        }
      }
    );
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
    >
      <Busca
        rotulo="Colaborador"
        busca={buscaColaborador}
        aoBuscar={(v) => {
          setBuscaColaborador(v);
          setColaboradorId(null);
        }}
        carregando={colaboradores.isFetching}
        erro={
          colaboradores.isError
            ? descreverErroDoCadastro(colaboradores.error, "acompanhamento").descricao
            : null
        }
        vazio={colaboradores.isSuccess && colaboradores.data.length === 0}
        textoVazio="Nenhum colaborador encontrado. Só aparecem colaboradores ativos, das operações do seu escopo e que ainda não são participantes."
      >
        {colaboradores.data?.map((c) => (
          <OpcaoDoColaborador
            key={c.id}
            colaborador={c}
            marcado={colaboradorId === c.id}
            aoMarcar={() => setColaboradorId(c.id)}
          />
        ))}
      </Busca>

      <Busca
        rotulo="Usuário"
        busca={buscaUsuario}
        aoBuscar={(v) => {
          setBuscaUsuario(v);
          setUsuarioId(null);
        }}
        carregando={usuarios.isFetching}
        erro={
          usuarios.isError
            ? descreverErroDoCadastro(usuarios.error, "acompanhamento").descricao
            : null
        }
        vazio={usuarios.isSuccess && usuarios.data.length === 0}
        textoVazio="Nenhum usuário encontrado. Só aparecem usuários ativos, de perfil comum, que ainda não são participantes."
      >
        {usuarios.data?.map((u) => (
          <OpcaoDoUsuario
            key={u.id}
            usuario={u}
            marcado={usuarioId === u.id}
            aoMarcar={() => setUsuarioId(u.id)}
          />
        ))}
      </Busca>

      {cadastrar.isError ? (
        <MensagemDeErro>
          {descreverErroDoCadastro(cadastrar.error, "acompanhamento").descricao}
        </MensagemDeErro>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={aoFechar} disabled={cadastrar.isPending}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={colaboradorId === null || usuarioId === null}
          loading={cadastrar.isPending}
        >
          {cadastrar.isPending ? "Cadastrando..." : "Cadastrar participante"}
        </Button>
      </div>
    </form>
  );
}

type BuscaProps = {
  rotulo: string;
  busca: string;
  aoBuscar: (valor: string) => void;
  carregando: boolean;
  erro: string | null;
  vazio: boolean;
  textoVazio: string;
  children: React.ReactNode;
};

function Busca({
  rotulo,
  busca,
  aoBuscar,
  carregando,
  erro,
  vazio,
  textoVazio,
  children
}: BuscaProps) {
  const valida = buscaValida(busca);
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{rotulo}</legend>
      <Input
        label={`Buscar ${rotulo.toLowerCase()}`}
        placeholder={rotulo === "Colaborador" ? "Nome ou matrícula" : "Nome ou e-mail"}
        helperText={`Digite ao menos ${labBuscaMinimaCaracteres} letras.`}
        value={busca}
        onChange={(e) => aoBuscar(e.target.value)}
        autoComplete="off"
      />
      <div role="radiogroup" aria-label={rotulo} className="space-y-1.5">
        {valida ? children : null}
      </div>
      {valida && carregando ? (
        <p className="text-lab-legenda text-lab-tinta-2">Buscando...</p>
      ) : null}
      {valida && erro ? (
        <MensagemDeErro variante="texto" className="text-lab-legenda">
          {erro}
        </MensagemDeErro>
      ) : null}
      {valida && vazio && !carregando ? (
        <p className="text-lab-legenda text-lab-tinta-2">{textoVazio}</p>
      ) : null}
    </fieldset>
  );
}

function Opcao({
  nome,
  marcado,
  aoMarcar,
  children
}: {
  nome: string;
  marcado: boolean;
  aoMarcar: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lab-md border p-3 text-lab-pequeno transition",
        marcado
          ? "border-lab-destaque bg-lab-destaque-suave"
          : "border-lab-linha hover:bg-lab-superficie-2"
      )}
    >
      <Marcacao type="radio" name={nome} checked={marcado} onChange={aoMarcar} className="mt-1" />
      <span className="min-w-0 space-y-0.5">{children}</span>
    </label>
  );
}

function OpcaoDoColaborador({
  colaborador: c,
  marcado,
  aoMarcar
}: {
  colaborador: LabColaboradorDoCadastro;
  marcado: boolean;
  aoMarcar: () => void;
}) {
  return (
    <Opcao nome="colaborador" marcado={marcado} aoMarcar={aoMarcar}>
      <span className="block font-medium text-lab-tinta">{c.nome}</span>
      <span className="block text-lab-legenda text-lab-tinta-2">
        Matrícula {c.identificador} · {c.cargo ?? "Sem cargo"} · {c.operacao}
      </span>
      <span className="block text-lab-legenda">
        <SeloDoMolde molde={c.molde} />
      </span>
    </Opcao>
  );
}

function OpcaoDoUsuario({
  usuario: u,
  marcado,
  aoMarcar
}: {
  usuario: LabUsuarioElegivel;
  marcado: boolean;
  aoMarcar: () => void;
}) {
  return (
    <Opcao nome="usuario" marcado={marcado} aoMarcar={aoMarcar}>
      <span className="block font-medium text-lab-tinta">{u.nome}</span>
      <span className="block text-lab-legenda text-lab-tinta-2">{u.email}</span>
    </Opcao>
  );
}
