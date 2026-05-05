/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: [] },
  webpack: (config, { isServer }) => {
    if (isServer) config.externals.push('fs', 'path', 'os', 'child_process', 'worker_threads', 'crypto');
    return config;
  },
};
export default nextConfig;
