import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // la importación masiva envía las filas del archivo como payload
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
