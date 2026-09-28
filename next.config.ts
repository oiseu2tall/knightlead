import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin Turbopack's root to this project. A stray empty package-lock.json
  // in the parent directory otherwise makes Next infer the parent as the
  // workspace root, which breaks module resolution.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
