/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: { externalDir: true }, // lets the app import ../abi/*.json shared with the relayer and indexer
  eslint: { ignoreDuringBuilds: true },
};
