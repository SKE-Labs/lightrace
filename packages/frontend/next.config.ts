import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@lightrace/shared", "@lightrace/backend"],
};

export default nextConfig;
