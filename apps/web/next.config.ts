const nextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: "100mb",
        },
    },
    images: {
        remotePatterns: [
            {
                protocol: "http",
                hostname: "0.0.0.0",
                port: "8000", // Leave empty if no specific port is required
                pathname: "/**", // Allow all paths
            },
            {
                protocol: "https",
                hostname: "hnqyngkyugiamvlhqoaf.supabase.co",
                port: "",
                pathname: "/**",
            },
            {
                protocol: "https",
                hostname: "*",
                pathname: "/**",
            },
            {
                protocol: "http",
                hostname: "*",
                pathname: "/**",
            },
        ],
    },
    eslint: {
        ignoreDuringBuilds: false,
    },
    typescript: {
        ignoreBuildErrors: false,
    },
    serverExternalPackages: ["import-in-the-middle", "require-in-the-middle"],

    async redirects() {
        return [
            {
                source: "/",
                destination: "/today",
                permanent: true,
            },
        ]
    },

    transpilePackages: ["@readspace/shared"],
}

export default nextConfig
