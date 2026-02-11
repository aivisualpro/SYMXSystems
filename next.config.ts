const nextConfig = {
  // This single line hides the indicator
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "www.appsheet.com",
      },
    ],
  },
};

export default nextConfig;
