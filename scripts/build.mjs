import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const types=spawnSync(process.execPath,['node_modules/typescript/bin/tsc'],{stdio:'inherit'});
if(types.status!==0) process.exit(types.status || 1);
await build({entryPoints:['src/index.ts','src/client.ts','src/next.ts'],outdir:'dist',bundle:true,format:'esm',platform:'neutral',target:'es2022',minify:true,legalComments:'none'});
await build({entryPoints:['src/react.tsx'],outfile:'dist/react.js',bundle:true,format:'esm',platform:'browser',target:'es2022',external:['react','react/jsx-runtime'],minify:true,legalComments:'none',banner:{js:'"use client";'}});
