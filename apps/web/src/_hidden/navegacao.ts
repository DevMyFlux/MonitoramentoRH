// Itens de menu dos módulos OCULTOS (QLP e Recrutamento). O menu só os recebe se o módulo estiver
// "active" em packages/shared/src/modules.ts; enquanto estiver oculto, nada daqui aparece.
import { MODULOS, type ModuloDef } from "@my-flux/shared";
import { Gauge, Users } from "lucide-react";
import type { NavigationItem } from "../features/navigation/nav-items";

export function itensDeMenuOcultos(
  registro: Readonly<Record<string, ModuloDef>> = MODULOS
): NavigationItem[] {
  const itens: NavigationItem[] = [];
  if (registro.qlp?.status === "active") itens.push({ label: "QLP", href: "/qlp", icon: Gauge });
  if (registro.recrutamento?.status === "active")
    itens.push({ label: "Recrutamento", href: "/recrutamento", icon: Users });
  return itens;
}
