import type { Config } from "tailwindcss";

/** Cor do design system do Lab: o canal RGB vem de uma variável CSS (tokens.css), com opacidade. */
const lab = (nome: string) => `rgb(var(--lab-${nome}) / <alpha-value>)`;

/** Cor do MY FLUX: o canal RGB vem de uma variável CSS (styles.css), com opacidade. */
const mf = (nome: string) => `rgb(var(--mf-${nome}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Fontes do MY FLUX (carregadas em main.tsx). `sans` é o corpo; `display`, títulos e números
      // grandes; `mono`, matrículas e códigos.
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: [
          '"Bricolage Grotesque Variable"',
          '"Inter Variable"',
          "ui-sans-serif",
          "sans-serif"
        ],
        mono: ['"JetBrains Mono Variable"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        "lab-sm": "0.5rem",
        "lab-md": "0.75rem",
        "lab-lg": "1.125rem",
        "lab-xl": "1.5rem",
        // Escala do MY FLUX (tokens em styles.css).
        "mf-controle": "var(--mf-raio-controle)",
        "mf-cartao": "var(--mf-raio-cartao)",
        "mf-conteiner": "var(--mf-raio-conteiner)"
      },
      // Design system do Leadership Lab. Os valores moram em features/leadership-lab/ui/tokens.css.
      colors: {
        // Paleta do MY FLUX (tokens em styles.css). Só estas cores; efeitos usam as mesmas com
        // transparência (bg-mf-brilho/10).
        mf: {
          primaria: mf("primaria"),
          brilho: mf("brilho"),
          realce: mf("realce"),
          "realce-suave": mf("realce-suave"),
          azul: mf("azul"),
          "azul-suave": mf("azul-suave"),
          tinta: mf("tinta"),
          texto: mf("texto"),
          "texto-2": mf("texto-2"),
          "texto-3": mf("texto-3"),
          linha: mf("linha"),
          fundo: mf("fundo"),
          cartao: mf("cartao"),
          perigo: mf("perigo"),
          "perigo-suave": mf("perigo-suave"),
          alerta: mf("alerta"),
          "alerta-suave": mf("alerta-suave")
        },
        navy: {
          900: "#0f172a",
          800: "#1e293b"
        },
        lab: {
          fundo: lab("fundo"),
          superficie: lab("superficie"),
          "superficie-2": lab("superficie-2"),
          "superficie-3": lab("superficie-3"),
          tinta: lab("tinta"),
          "tinta-2": lab("tinta-2"),
          "tinta-3": lab("tinta-3"),
          linha: lab("linha"),
          "linha-forte": lab("linha-forte"),
          destaque: lab("destaque"),
          "destaque-forte": lab("destaque-forte"),
          "destaque-suave": lab("destaque-suave"),
          "destaque-texto": lab("destaque-texto"),
          sucesso: lab("sucesso"),
          "sucesso-suave": lab("sucesso-suave"),
          "sucesso-texto": lab("sucesso-texto"),
          aviso: lab("aviso"),
          "aviso-suave": lab("aviso-suave"),
          "aviso-texto": lab("aviso-texto"),
          perigo: lab("perigo"),
          "perigo-suave": lab("perigo-suave"),
          "perigo-texto": lab("perigo-texto"),
          info: lab("info"),
          "info-suave": lab("info-suave"),
          "info-texto": lab("info-texto")
        }
      },
      boxShadow: {
        "lab-1": "var(--lab-sombra-1)",
        "lab-2": "var(--lab-sombra-2)",
        "lab-3": "var(--lab-sombra-3)",
        "mf-1": "var(--mf-sombra-1)",
        "mf-2": "var(--mf-sombra-2)",
        "mf-3": "var(--mf-sombra-3)"
      },
      fontSize: {
        "lab-display": [
          "2.75rem",
          { lineHeight: "1.05", letterSpacing: "-0.032em", fontWeight: "600" }
        ],
        "lab-h1": [
          "2rem",
          { lineHeight: "2.375rem", letterSpacing: "-0.022em", fontWeight: "600" }
        ],
        "lab-h2": [
          "1.3125rem",
          { lineHeight: "1.75rem", letterSpacing: "-0.014em", fontWeight: "600" }
        ],
        "lab-h3": [
          "1.0625rem",
          { lineHeight: "1.5rem", letterSpacing: "-0.01em", fontWeight: "600" }
        ],
        "lab-corpo": ["0.9375rem", { lineHeight: "1.5rem" }],
        "lab-pequeno": ["0.8125rem", { lineHeight: "1.25rem" }],
        "lab-legenda": ["0.75rem", { lineHeight: "1rem" }]
      },
      transitionTimingFunction: { lab: "var(--lab-ease)" },
      transitionDuration: { "lab-rapida": "150ms", lab: "250ms", "lab-lenta": "450ms" },
      // Animações do Leadership Lab. Todas são desligadas com motion-reduce nos componentes.
      keyframes: {
        "lab-entrada": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "lab-fala": {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" }
        },
        "lab-pisca": {
          "0%, 93%, 100%": { transform: "scaleY(1)" },
          "96%": { transform: "scaleY(0.08)" }
        },
        "lab-flutua": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" }
        },
        "lab-pontos": { "0%, 100%": { opacity: "0.25" }, "50%": { opacity: "1" } },
        "lab-brilho": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { opacity: "1", transform: "scale(1.15)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        "lab-brilho-varrido": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" }
        },
        "lab-pulso-anel": {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "100%": { transform: "scale(1.9)", opacity: "0" }
        }
      },
      animation: {
        "lab-entrada": "lab-entrada 0.4s ease-out both",
        "lab-fala": "lab-fala 0.45s ease-in-out infinite",
        "lab-pisca": "lab-pisca 4.5s ease-in-out infinite",
        "lab-flutua": "lab-flutua 2.4s ease-in-out infinite",
        "lab-pontos": "lab-pontos 1.2s ease-in-out infinite",
        "lab-brilho": "lab-brilho 0.5s ease-out both",
        "lab-esqueleto": "lab-brilho-varrido 1.8s linear infinite",
        "lab-pulso-anel": "lab-pulso-anel 1.8s ease-out infinite"
      }
    }
  },
  plugins: []
} satisfies Config;
