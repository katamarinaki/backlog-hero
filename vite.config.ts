import react from "@vitejs/plugin-react";
import path from "path";

export default {
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist/renderer",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer"),
    },
  },
};
