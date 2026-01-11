/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            // Correct syntax: (self) allows own origin, () blocks entirely
            value: 'camera=(self), microphone=(self), geolocation=()'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
