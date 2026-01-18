const path = require('path');
const { config } = require('dotenv');

// Load .env from parent directory
config({ path: path.resolve(__dirname, '..', '.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing from parent directory (shared types)
  transpilePackages: [],
  experimental: {
    serverComponentsExternalPackages: ['openai'],
  },
}

module.exports = nextConfig
