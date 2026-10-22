// Gera dois segredos aleatórios para assinar as sessões (JWT) em produção.
// Rode na SUA máquina e cole os valores direto no painel do serviço de hospedagem. Nada é gravado em arquivo e
// os valores NÃO devem ser colocados no repositório, em chat ou em e-mail. Veja "Segredos de produção" no README.
import { randomBytes } from "node:crypto";

const secret = () => randomBytes(48).toString("base64url"); // 64 caracteres

console.log(`JWT_ACCESS_SECRET=${secret()}`);
console.log(`JWT_REFRESH_SECRET=${secret()}`);
console.error(
  "\nOs dois valores são diferentes de propósito. Defina-os no ambiente de produção (não commite)."
);
