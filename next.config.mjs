/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gzqaoupdixaqsdjgzlid.supabase.co',
      },
    ],
  },
  allowedDevOrigins: [
    '192.168.1.204',
    '192.168.43.202',
    '192.168.142.204',
    '192.168.0.157',
    '192.168.0.156',
    '192.168.107.204',
    '192.168.137.1'
  ],
};

export default nextConfig;
