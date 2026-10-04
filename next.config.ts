import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  outputFileTracingIncludes: { '/api/movin': ['./data/**/*'] },
  experimental: { workerThreads: true, cpus: 1, useTypeScriptCli: false },
};

export default nextConfig;
