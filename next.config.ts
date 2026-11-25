import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pptxgenjs", "mammoth", "unpdf"],
};

export default nextConfig;
