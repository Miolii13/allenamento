import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Scrive precache.json con tutti i file della build: il service worker li salva subito per l'uso offline. */
function precacheList(): Plugin {
  return {
    name: 'precache-list',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html');
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) });
    },
  };
}

// base relativa: l'app funziona anche se pubblicata in una sottocartella (es. GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [react(), precacheList()],
});
