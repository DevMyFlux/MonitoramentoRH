import { describe, expect, it } from "vitest";
import {
  filtrarColaboradores,
  filtrosAtivos,
  type FiltrosDeColaboradores,
  type Rodizio
} from "./filtros";

const OP = "op-1";
const pessoas = [
  { id: "a", name: "Ana", operationId: OP, status: "ACTIVE", shift: "DIURNO", r: "IMPAR" },
  { id: "b", name: "Bruno", operationId: OP, status: "ACTIVE", shift: "NOTURNO", r: "PAR" },
  { id: "c", name: "Carla", operationId: OP, status: "VACATION", shift: "DIURNO", r: "PAR" },
  { id: "d", name: "Davi", operationId: OP, status: "TERMINATED", shift: "DIURNO", r: "IMPAR" },
  { id: "e", name: "Elisa", operationId: OP, status: "ACTIVE", shift: "COMERCIAL", r: "5X2" },
  { id: "f", name: "Fábio", operationId: "op-2", status: "ACTIVE", shift: "DIURNO", r: "PAR" }
] as const;

const base: FiltrosDeColaboradores = {
  operationId: OP,
  busca: "",
  mostrarDesligados: false,
  turno: "",
  situacao: "",
  rodizio: ""
};
const ids = (filtros: Partial<FiltrosDeColaboradores>) =>
  filtrarColaboradores(pessoas, { ...base, ...filtros }, (p) => p.r as Rodizio).map((p) => p.id);

describe("filtros de colaboradores", () => {
  it("sem filtros: a unidade, sem os desligados", () => {
    expect(ids({})).toEqual(["a", "b", "c", "e"]);
    expect(ids({ mostrarDesligados: true })).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("turno, situação e rodízio se combinam", () => {
    expect(ids({ turno: "DIURNO" })).toEqual(["a", "c"]);
    expect(ids({ situacao: "ACTIVE" })).toEqual(["a", "b", "e"]);
    expect(ids({ rodizio: "PAR" })).toEqual(["b", "c"]);
    expect(ids({ rodizio: "5X2" })).toEqual(["e"]);
    expect(ids({ turno: "DIURNO", rodizio: "PAR" })).toEqual(["c"]);
  });

  it("pedir a situação Desligado mostra os desligados mesmo com o interruptor apagado", () => {
    expect(ids({ situacao: "TERMINATED" })).toEqual(["d"]);
  });

  it("a busca livre ignora maiúsculas", () => {
    expect(ids({ busca: "  bruno " })).toEqual(["b"]);
  });

  it("conta os filtros ligados, sem contar a unidade", () => {
    expect(filtrosAtivos(base)).toBe(0);
    expect(filtrosAtivos({ ...base, busca: "x", turno: "DIURNO", rodizio: "PAR" })).toBe(3);
  });
});
