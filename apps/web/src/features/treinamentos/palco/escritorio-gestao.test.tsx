// @vitest-environment jsdom
// O pacote de cena "escritorio-gestao": os 5 planos, a reação de cada comando (ok, alerta, falha), o
// HUD de pendências, o movimento reduzido e o fallback. Também confere que os 40 cenários do Lab só
// usam planos e comandos que o pacote desenha.
import { ESCRITORIO_GESTAO, validarCenarioImportado } from "@my-flux/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const movimento = vi.hoisted(() => ({ reduzido: false }));
vi.mock("./movimento", () => ({ useMovimentoReduzido: () => movimento.reduzido }));

import { cameraDoPlano, escritorioGestao, pacoteDeCena } from "./pacotes";
import { Palco } from "./palco";

afterEach(() => {
  cleanup();
  movimento.reduzido = false;
});

const props = {
  hud: { titulo: "Checklist de OS incompleto", hora: "Segunda, 08h" },
  telaCheia: { ativa: false, alternar: () => undefined }
};

describe("pacote escritorio-gestao", () => {
  it("é o pacote do id certo e tem um plano de câmera para cada plano do vocabulário", () => {
    expect(pacoteDeCena("escritorio-gestao")).toBe(escritorioGestao);
    for (const plano of ESCRITORIO_GESTAO.planos)
      expect(Object.keys(escritorioGestao.planos), plano).toContain(plano);
    // Cada plano enquadra algo diferente (não cai no plano geral).
    const geral = cameraDoPlano(escritorioGestao, "geral");
    for (const plano of ESCRITORIO_GESTAO.planos)
      expect(cameraDoPlano(escritorioGestao, plano), plano).not.toEqual(geral);
    // Plano desconhecido = plano geral, sem quebrar.
    expect(cameraDoPlano(escritorioGestao, "plano-que-nao-existe")).toEqual(geral);
  });

  it("descreve a cena em texto: neutra, e depois de cada comando", () => {
    const neutro = escritorioGestao.descrever(escritorioGestao.estadoInicial);
    expect(neutro).toMatch(/tela do sistema/);
    expect(neutro).toMatch(/sala de reunião/);
    const ok = escritorioGestao.descrever({ tela: "ok", mesa: "ok" });
    expect(ok).toMatch(/selo de confirmação/);
    expect(ok).toMatch(/mesa está em ordem/);
    expect(escritorioGestao.descrever({ documento: "alerta" })).toMatch(/carimbo de atenção/);
    expect(escritorioGestao.descrever({ relogio: "falha" })).toMatch(/prazo estourado/);
    expect(escritorioGestao.descrever({ reuniao: "falha" })).toMatch(/problema sem tratamento/);
  });

  it("pendências: começam em 5, descem a cada ok e sobem se uma frente que estava ok falha", () => {
    const pendencias = (estado: Record<string, string>) => {
      const [indicador] = escritorioGestao.indicadores!({
        ...escritorioGestao.estadoInicial,
        ...estado
      });
      return indicador!;
    };
    expect(pendencias({})).toEqual({ rotulo: "Pendências", valor: "5", tom: "neutro" });
    expect(pendencias({ tela: "ok", mesa: "ok" }).valor).toBe("3");
    const resolvido = pendencias({
      tela: "ok",
      mesa: "ok",
      reuniao: "ok",
      documento: "ok",
      relogio: "ok"
    });
    expect(resolvido).toEqual({ rotulo: "Pendências", valor: "0", tom: "ok" });
    // Uma frente que estava ok volta a falhar: a pendência sobe e o tom vira risco.
    const depois = pendencias({
      tela: "falha",
      mesa: "ok",
      reuniao: "ok",
      documento: "ok",
      relogio: "ok"
    });
    expect(depois).toEqual({ rotulo: "Pendências", valor: "1", tom: "risco" });
    expect(pendencias({ tela: "alerta" }).tom).toBe("atencao");
  });

  it("partículas: poeira no ar, brasas quando alguma frente falha", () => {
    expect(escritorioGestao.particulas({})).toBe("poeira");
    expect(escritorioGestao.particulas({ tela: "alerta" })).toBe("poeira");
    expect(escritorioGestao.particulas({ mesa: "falha" })).toBe("brasas");
  });
});

describe("Palco com o pacote escritorio-gestao", () => {
  it("mostra a cena descrita, o horário e o indicador de pendências no HUD", () => {
    render(<Palco pacote="escritorio-gestao" estado={{ tela: "ok" }} plano="tela" {...props} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/selo de confirmação/);
    expect(screen.getByText("Segunda, 08h")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Pendências: 4" })).toBeTruthy();
  });

  it("reage a cada comando: ok, alerta e falha mudam a cena (e alerta e falha animam)", () => {
    const { container, rerender } = render(
      <Palco pacote="escritorio-gestao" estado={{ mesa: "alerta" }} plano="mesa" {...props} />
    );
    expect(container.querySelector(".palco-pulso")).not.toBeNull();
    rerender(
      <Palco pacote="escritorio-gestao" estado={{ mesa: "falha" }} plano="mesa" {...props} />
    );
    expect(container.querySelector(".palco-vibra")).not.toBeNull();
    expect(container.querySelector(".palco-pulso")).toBeNull();
    rerender(<Palco pacote="escritorio-gestao" estado={{ mesa: "ok" }} plano="mesa" {...props} />);
    expect(container.querySelector(".palco-pulso, .palco-vibra")).toBeNull();
    // Âmbar e vermelho sempre trazem um símbolo, nunca só a cor: a cena tem o selo do estado.
    expect(container.querySelector("path[d^='M-10 1']")).not.toBeNull();
  });

  it("com movimento reduzido nada pulsa, vibra, gira nem tem partícula ou grão", () => {
    movimento.reduzido = true;
    const { container } = render(
      <Palco
        pacote="escritorio-gestao"
        estado={{ mesa: "falha", tela: "alerta", relogio: "alerta" }}
        plano="geral"
        {...props}
      />
    );
    for (const classe of [
      ".palco-pulso",
      ".palco-vibra",
      ".palco-ponteiro",
      ".palco-led",
      ".palco-luminaria"
    ])
      expect(container.querySelector(classe), classe).toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".palco-grao")).toBeNull();
    // O estado continua visível (parado), com a descrição em texto.
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/mesa está bagunçada/);
  });

  it("os outros pacotes seguem sem o indicador de pendências", () => {
    render(
      <Palco
        pacote="hospital-escala"
        estado={{}}
        plano="sala"
        hud={{ titulo: "Sala", hora: "22:00" }}
        telaCheia={props.telaCheia}
      />
    );
    expect(screen.queryByRole("status", { name: /Pendências/ })).toBeNull();
  });
});

describe("os 40 cenários do Lab no pacote", () => {
  const pasta = resolve(process.cwd(), "../../docs/cenarios-lab");
  const arquivos = readdirSync(pasta).filter((n) => n.endsWith(".json") && n !== "_indice.json");

  it("todos usam só planos que têm câmera e comandos que o mundo desenha", () => {
    expect(arquivos).toHaveLength(40);
    const planos = Object.keys(escritorioGestao.planos);
    for (const nome of arquivos) {
      const resultado = validarCenarioImportado(
        JSON.parse(readFileSync(resolve(pasta, nome), "utf8"))
      );
      if (!resultado.ok) throw new Error(`${nome} inválido`);
      for (const pergunta of resultado.cenario.questions) {
        expect(planos, `${nome} ${pergunta.id}`).toContain(pergunta.shot);
        for (const alternativa of pergunta.alternatives)
          for (const [objeto, comando] of Object.entries(alternativa.beat.scene)) {
            expect(planos, `${nome} objeto ${objeto}`).toContain(objeto);
            expect(ESCRITORIO_GESTAO.comandos as readonly string[], `${nome} ${objeto}`).toContain(
              comando
            );
          }
      }
    }
  });
});
