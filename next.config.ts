import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/kuromoji-dict/**/*"],
  },
};

export default nextConfig;
