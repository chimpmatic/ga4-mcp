import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const isProduction = process.env.NODE_ENV === 'production';

await esbuild.build({
    entryPoints: ['src/server.ts'],
    bundle: true,
    outfile: 'dist/server.js',
    platform: 'node',
    target: 'node18',
    format: 'esm',
    sourcemap: !isProduction,
    minify: isProduction,
    banner: { js: '#!/usr/bin/env node' },
    define: {
        '__PKG_VERSION__': JSON.stringify(pkg.version),
    },
    external: Object.keys(pkg.dependencies),
});

console.log('Build complete.');
