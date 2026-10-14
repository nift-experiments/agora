import {writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dir,'..');const app=join(root,'app');process.chdir(app);process.env.NIFT_CONTENT_ROOT=join(app,'public');process.env.TSS_CLIENT_OUTPUT_DIR=join(app,'public');
const handler=(await import(join(app,'dist/server/server.js'))).default;
const response=await handler.fetch(new Request('https://docs.agora.io'+process.argv[2],{headers:{'User-Agent':'NiftPrerenderBot/1.0'}}));
const html=await response.text();await writeFile(join(root,'.generated/debug-ssr.html'),html);console.log(response.status,html.length,html.indexOf('data-static-docs-body'),html.includes('docs-content-skeleton'));
