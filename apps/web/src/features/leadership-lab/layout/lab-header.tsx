import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, Settings, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearSession } from "../../my-flux/client";
import { useUsuarioAtual } from "../../auth/use-usuario-atual";
import { Badge, Button, MenuDeAcoes } from "../ui";
import { iniciais } from "./navegacao";

type LabHeaderProps = { breadcrumbs: string[]; aoAbrirMenu: () => void };

function Migalhas({ itens }: { itens: string[] }) {
  return (
    <nav
      aria-label="Caminho da página"
      className="flex min-w-0 items-center gap-2 text-lab-pequeno text-lab-tinta-2"
    >
      {itens.map((item, indice) => {
        const ultimo = indice === itens.length - 1;
        return (
          <span
            key={`${item}-${indice}`}
            className={`min-w-0 items-center gap-2 ${indice === 0 ? "hidden sm:flex" : "flex"}`}
          >
            {indice > 0 ? (
              <span aria-hidden="true" className="text-lab-linha-forte">
                /
              </span>
            ) : null}
            <span
              className={ultimo ? "truncate font-medium text-lab-tinta" : "truncate"}
              aria-current={ultimo ? "page" : undefined}
            >
              {item === "MY FLUX" ? "MyFlux" : item}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

export function LabHeader({ breadcrumbs, aoAbrirMenu }: LabHeaderProps) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const usuario = useUsuarioAtual().data;

  function sair() {
    clearSession();
    cache.clear();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-lab-linha/80 bg-lab-fundo/80 backdrop-blur-2xl">
      <div className="flex h-[var(--lab-altura-topo)] items-center justify-between gap-3 px-4 lg:px-10">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            aria-label="Abrir menu"
            aria-controls="main-sidebar"
            className="-ml-2 lg:hidden"
            icon={<Menu size={20} aria-hidden="true" />}
            onClick={aoAbrirMenu}
            size="icon"
            variant="ghost"
          />
          <Migalhas itens={breadcrumbs} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-lab-pequeno text-lab-tinta-2 xl:block">
            {new Intl.DateTimeFormat("pt-BR", {
              day: "numeric",
              month: "long",
              year: "numeric"
            }).format(new Date())}
          </span>
          <MenuDeAcoes
            rotulo="Menu da conta"
            gatilho={
              <>
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 place-items-center rounded-full bg-lab-destaque-suave text-lab-legenda font-semibold text-lab-destaque-texto"
                >
                  {usuario ? iniciais(usuario.name) : <UserRound size={16} />}
                </span>
                <span className="hidden max-w-[10rem] truncate text-lab-pequeno font-medium sm:block">
                  {usuario?.name ?? "Conta"}
                </span>
              </>
            }
            cabecalho={
              usuario ? (
                <div className="space-y-1.5">
                  <p className="truncate text-lab-pequeno font-semibold text-lab-tinta">
                    {usuario.name}
                  </p>
                  <p className="truncate text-lab-legenda text-lab-tinta-2">{usuario.email}</p>
                  <Badge>{usuario.role}</Badge>
                </div>
              ) : (
                <p className="text-lab-pequeno text-lab-tinta-2">Conta</p>
              )
            }
            itens={[
              {
                tipo: "link",
                rotulo: "Parâmetros",
                para: "/parametros",
                icone: <Settings size={16} aria-hidden="true" className="text-lab-tinta-2" />
              },
              {
                tipo: "acao",
                rotulo: "Sair",
                aoClicar: sair,
                icone: <LogOut size={16} aria-hidden="true" />,
                perigo: true
              }
            ]}
          />
        </div>
      </div>
    </header>
  );
}
