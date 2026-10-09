/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  experimental: { externalDir: true }, // lets the app import ../abi/*.json shared with the relayer and indexer
  eslint: { ignoreDuringBuilds: true },
};
