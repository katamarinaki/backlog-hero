import path from 'path';

import react from '@vitejs/plugin-react';

export default {
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist/renderer',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      components: path.resolve(__dirname, './src/renderer/components'),
      pages: path.resolve(__dirname, './src/renderer/pages'),
      context: path.resolve(__dirname, './src/renderer/context'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
};
