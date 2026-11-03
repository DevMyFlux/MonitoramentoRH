/* eslint-disable react-refresh/only-export-components */
// Apoio dos testes de componente: renderiza com o TanStack Query e um roteador de memória, e
// mostra o endereço atual em qualquer rota que não seja a da tela testada (para conferir para onde
// a tela navegou).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach } from "vitest";

afterEach(() => cleanup());

function LocalAtual() {
  return <p data-testid="local">{useLocation().pathname}</p>;
}

/**
 * Sem descartar cache. A repetição automática que a tela pede (uma só, para falha passageira) vale,
 * mas sem esperar o intervalo de 1 s, para o teste não ficar lento.
 */
export function novoCliente(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: Infinity },
      mutations: { retry: false }
    }
  });
}

export function renderizar(
  elemento: ReactElement,
  opcoes: { rota?: string; caminho?: string; cliente?: QueryClient } = {}
) {
  const cliente = opcoes.cliente ?? novoCliente();
  const rota = opcoes.rota ?? "/";
  const resultado = render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path={opcoes.caminho ?? rota} element={elemento} />
          <Route path="*" element={<LocalAtual />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...resultado, cliente };
}
