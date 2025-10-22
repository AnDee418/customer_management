import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#14243F",
          accent: "#ce6b0f",
          "accent-hover": "#b55e0d",
        },
        base: {
          bg: "#e2e2e2",
        },
      },
    },
  },
  plugins: [],
};
export default config;

