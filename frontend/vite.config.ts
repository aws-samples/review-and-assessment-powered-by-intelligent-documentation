import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  // The base public path can be injected at build time (e.g. by the CDK build)
  // so the SPA works when served under an API Gateway stage prefix such as "/app/".
  // Defaults to "/" which matches the standard CloudFront delivery mode.
  base: process.env.VITE_APP_BASE_PATH || "/",
  plugins: [react()],
  server: {
    port: 5173,
  },
});
