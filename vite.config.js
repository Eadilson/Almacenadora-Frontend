import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react()],
    resolve: {
      // Alias único: evita cadenas de `../../../` que se rompen al mover un archivo.
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: {
      port: 5173,
      strictPort: true,
      // El proxy hace que en desarrollo el navegador vea un mismo origen. Sin él,
      // la cookie httpOnly del token de refresco sería de tercera parte y varios
      // navegadores la descartarían, rompiendo la renovación de sesión.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000',
          changeOrigin: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      // El código fuente original no se publica por defecto. Se puede habilitar
      // expresamente para un despliegue privado de diagnóstico.
      sourcemap: env.VITE_ENABLE_SOURCEMAPS === 'true',
      rollupOptions: {
        output: {
          // Se separan las dependencias que cambian poco para que un despliegue no
          // invalide toda la caché del navegador.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query', 'axios'],
            charts: ['recharts'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.test.{js,jsx}'],
    },
  };
});
