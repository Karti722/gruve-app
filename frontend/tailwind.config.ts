import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f1ff",
          100: "#e6e4ff",
          400: "#8b7dff",
          500: "#6c5ce7",
          600: "#5541d6",
          900: "#241f4d",
        },
      },
    },
  },
  plugins: [],
};

export default config;
