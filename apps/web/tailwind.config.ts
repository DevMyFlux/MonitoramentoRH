import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: { DEFAULT: "0.75rem" },
      // Animações do Leadership Lab. Todas são desligadas com motion-reduce nos componentes.
      keyframes: {
        "lab-entrada": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "lab-fala": { "0%, 100%": { transform: "scaleY(0.35)" }, "50%": { transform: "scaleY(1)" } },
        "lab-pisca": { "0%, 93%, 100%": { transform: "scaleY(1)" }, "96%": { transform: "scaleY(0.08)" } },
        "lab-flutua": { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-3px)" } },
        "lab-pontos": { "0%, 100%": { opacity: "0.25" }, "50%": { opacity: "1" } },
        "lab-brilho": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { opacity: "1", transform: "scale(1.15)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        }
      },
      animation: {
        "lab-entrada": "lab-entrada 0.4s ease-out both",
        "lab-fala": "lab-fala 0.45s ease-in-out infinite",
        "lab-pisca": "lab-pisca 4.5s ease-in-out infinite",
        "lab-flutua": "lab-flutua 2.4s ease-in-out infinite",
        "lab-pontos": "lab-pontos 1.2s ease-in-out infinite",
        "lab-brilho": "lab-brilho 0.5s ease-out both"
      },
      colors: {
        navy: {
          900: "#0f172a",
          800: "#1e293b"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
