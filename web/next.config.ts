const nextConfig = {
    redirects: async () => {
        return [
            {
                source: "/",
                destination: "/library",
                permanent: true,
            },
        ]
    },
    experimental: {
        serverActions: {
            bodySizeLimit: "100mb",
        },
    },
    images: {
        remotePatterns: [
            {
                protocol: "http",
                hostname: "127.0.0.1",
                port: "54321", // Leave empty if no specific port is required
                pathname: "/**", // Allow all paths
            },
            {
                protocol: "http",
                hostname: "localhost",
                port: "54321", // Leave empty if no specific port is required
                pathname: "/**", // Allow all paths
            },
        ],
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    serverExternalPackages: ["import-in-the-middle", "require-in-the-middle"],
}

export default nextConfig
