import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: { DEFAULT: "0.75rem" },
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
