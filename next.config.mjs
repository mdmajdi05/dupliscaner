/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: [] },
  webpack: (config, { isServer }) => {
    if (isServer) config.externals.push('fs', 'path', 'os', 'child_process');
    return config;
  },
};
export default nextConfig;
