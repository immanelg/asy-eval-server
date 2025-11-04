import { defineConfig } from 'vite'

export default defineConfig(({mode}) => {
    return {
        server: {
            proxy: {
                '/api': {
                    target: 'http://localhost:8050/',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/api/, ''),
                },
            },
        },
    };
})
