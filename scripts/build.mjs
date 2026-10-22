/**
 * Compila el juego en un único index.html autocontenido.
 *
 *   node scripts/build.mjs            → dist/index.html  (React incluido; para Cloudflare Pages)
 *   node scripts/build.mjs artifact   → dist/artifact.html (mismo bundle verificado, sin envoltorio <html>, para publicarlo como Artifact)
 *
 * Se usa esbuild directamente (es el compilador que Vite usa internamente).
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const mode = process.argv[2] === 'artifact' ? 'artifact' : 'web';
const root = new URL('..', import.meta.url).pathname;
// Recalcular la red cartográfica antes de empaquetar para evitar datos obsoletos.
execFileSync(process.execPath, ['--import', 'tsx', 'scripts/generate-geo.ts'], { cwd: root, stdio: 'inherit' });

const globalsPlugin = {
  name: 'react-globals',
  setup(b) {
    b.onResolve({ filter: /^react(-dom)?(\/client)?$/ }, (args) => ({ path: args.path, namespace: 'react-global' }));
    b.onLoad({ filter: /.*/, namespace: 'react-global' }, (args) => ({
      contents: `module.exports = window.${args.path.startsWith('react-dom') ? 'ReactDOM' : 'React'};`,
      loader: 'js',
    }));
  },
};

const result = await build({
  entryPoints: [root + 'src/main.tsx'],
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  target: ['es2020', 'safari15'],
  outdir: root + 'dist/tmp',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  inject: [root + 'scripts/react-shim.js'],
  define: { 'process.env.NODE_ENV': '"production"' },
  // React va incluido en ambos modos: es la misma compilación que pasa las pruebas.
  // (globalsPlugin permite cargar React desde un CDN si algún día se prefiere.)
  plugins: process.env.REACT_FROM_CDN ? [globalsPlugin] : [],
  logLevel: 'warning',
});

const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
const css = result.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700;800&family=Source+Sans+3:wght@400;600;700&display=swap">';
const title = '<title>Simulador de Presidente</title>';

let html;
if (mode === 'artifact') {
  html = `${title}
<meta name="claude:viewport-fit-sides" content="cover">
${fonts}
<style>${css}</style>
<div id="root"></div>
${process.env.REACT_FROM_CDN ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>' : ''}
<script>${js}</script>
`;
} else {
  html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#152029">
<meta name="apple-mobile-web-app-capable" content="yes">
${title}
${fonts}
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);height:100%}[hidden]{display:none!important}</style>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;
}

mkdirSync(root + 'dist', { recursive: true });
const out = root + (mode === 'artifact' ? 'dist/artifact.html' : 'dist/index.html');
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} KB)`);
