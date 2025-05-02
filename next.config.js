/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Ensure we're looking at the correct directories
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  // Add a trailing slash to URLs
  trailingSlash: true,
}

module.exports = nextConfig 