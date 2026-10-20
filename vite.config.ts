import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  plugins: [{
    name: 'canonical-score-adapter',
    resolveId(id) { return id === 'virtual:canonical-score' ? '\0canonical-score' : null; },
    load(id) {
      if (id !== '\0canonical-score') return null;
      const entry = resolve(process.env.VIEWER_ADAPTER_ENTRY ?? 'src/adapters/index.ts');
      return existsSync(entry)
        ? `export const loadCanonical = () => import(${JSON.stringify(entry)});`
        : `export const loadCanonical = async () => { throw new Error('The canonical notation/playback adapter is not integrated in this build. PDF, MIDI and notes remain available.'); };`;
    },
  }, {
    name: 'bundled-dependency-notices',
    generateBundle() {
      const licenses = [
        '@coderline/alphatab/LICENSE', '@coderline/alphatab/dist/font/Bravura-OFL.txt',
        '@fontsource/dm-sans/LICENSE', '@fontsource/literata/LICENSE',
        'react/LICENSE', 'react-dom/LICENSE', 'zod/LICENSE', 'react-markdown/license',
      ];
      this.emitFile({ type: 'asset', fileName: 'assets/THIRD-PARTY-NOTICES.txt', source: licenses.map(file => `${file}\n\n${readFileSync(resolve('node_modules', file), 'utf8')}`).join('\n\n') });
    },
  }],
  resolve: { dedupe: ['zod', '@coderline/alphatab', 'react', 'react-dom'] },
  build: {
    outDir: 'dist/client', emptyOutDir: true, target: 'es2022',
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      input: { viewer: resolve('index.html'), canonical: resolve('src/client/canonical-entry.ts') },
      output: { entryFileNames: chunk => chunk.name === 'canonical' ? 'integrations/canonical.js' : 'assets/[name]-[hash].js' },
    },
  },
  server: { host: '0.0.0.0', strictPort: true, proxy: { '/api': 'http://127.0.0.1:3000' } },
});
