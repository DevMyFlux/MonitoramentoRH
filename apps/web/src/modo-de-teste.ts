// MODO DE TESTE (temporário): o front não pede login e todo visitante entra como o usuário DEV do
// seed. A mesma variável de build, VITE_MODO_TESTE_SEM_LOGIN, comanda App.tsx (o login automático);
// aqui ela também decide o que a tela mostra enquanto o modo está ligado (veja o menu do
// Leadership Lab e a página de quem não é participante).
//
// Lida a cada chamada, e não ao carregar o módulo, para os testes poderem trocar o valor.
export function modoDeTesteSemLogin(): boolean {
  return import.meta.env.VITE_MODO_TESTE_SEM_LOGIN !== "false";
}
