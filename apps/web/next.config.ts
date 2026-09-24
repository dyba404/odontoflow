import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// APP_VERSION se inyecta en build desde el package.json raiz (la version que se
// taggea en ship); /api/health la reporta en vez de un literal hardcodeado.
// La raiz queda DOS niveles arriba de apps/web (join("..") solo sube uno).
function versionApp(): string {
  for (const dir of [
    process.cwd(),
    join(process.cwd(), ".."),
    join(process.cwd(), "..", ".."),
  ]) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      if (pkg.name === "odontoflow") return pkg.version ?? "dev";
    } catch {
      // siguiente directorio
    }
  }
  return "dev";
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: { APP_VERSION: versionApp() },
};

export default nextConfig;
