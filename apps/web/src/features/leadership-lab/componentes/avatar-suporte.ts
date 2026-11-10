let suporte: boolean | undefined;

/** O navegador consegue criar um contexto WebGL? Resultado guardado: a checagem custa um canvas. */
export function suportaWebGL(): boolean {
  if (suporte !== undefined) return suporte;
  try {
    const canvas = document.createElement("canvas");
    suporte = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    suporte = false;
  }
  return suporte;
}
