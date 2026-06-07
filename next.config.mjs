/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // AudD returns cover art hosted on various CDNs; allow remote artwork.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
