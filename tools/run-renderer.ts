import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,join } from 'node:path';
const root=resolve(import.meta.dir,'..');await mkdir(join(root,'.generated'),{recursive:true});
const helpers=await Bun.build({entrypoints:[join(root,'app/src/lib/static-route-html.ts')],target:'node',format:'esm',write:false});
if(!helpers.success)throw new AggregateError(helpers.logs,'Renderer helper build failed');
const helper=await helpers.outputs[0].text();
async function writeChanged(path:string,value:string){if(await readFile(path,'utf8').catch(()=>null)!==value)await writeFile(path,value);}
await writeChanged(join(root,'.generated/render-helpers.mjs'),helper);
let source=await readFile(join(root,'tools/render-routes.ts'),'utf8');
source=source.replace("import { createStaticRouteHtml } from '../app/src/lib/static-route-html';", "import { fileURLToPath } from 'node:url';");
source=source.replace("const root = resolve(import.meta.dir, '..');", "const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');\nconst {createStaticRouteHtml}=await import(pathToFileURL(join(root,'.generated/render-helpers.mjs')).href);");
source=source.replace("!await Bun.file(join(output,page.url.slice(1),'index.html')).exists()", "!await access(join(output,page.url.slice(1),'index.html')).then(()=>true,()=>false)");
const renderer=new Bun.Transpiler({loader:'ts',target:'node'}).transformSync(source);
await writeChanged(join(root,'.generated/render-routes.mjs'),renderer);
const nodeArgs=['node','--max-old-space-size=512',join(root,'.generated/render-routes.mjs')];
const requested=process.argv.slice(2);
if(requested.some(arg=>arg.startsWith('/'))){
 const worker=Bun.spawn([...nodeArgs,...requested],{cwd:root,env:process.env,stdout:'inherit',stderr:'inherit'});
 process.exit(await worker.exited);
}
const planner=Bun.spawn([...nodeArgs,'--plan',...requested],{cwd:root,env:process.env,stdout:'pipe',stderr:'inherit'});
const planned=await new Response(planner.stdout).text();
if(await planner.exited)throw new Error('SSR planning failed');
const routes:string[]=JSON.parse(planned);
const batchSize=Number(process.env.NIFT_SSR_WORKER_SIZE??256);
if(!Number.isInteger(batchSize)||batchSize<1)throw new Error('Invalid SSR worker size');
for(let offset=0;offset<routes.length;offset+=batchSize){
 const selected=routes.slice(offset,offset+batchSize);
 const worker=Bun.spawn([...nodeArgs,...selected],{cwd:root,env:process.env,stdout:'inherit',stderr:'inherit'});
 if(await worker.exited)throw new Error('SSR worker failed');
 console.log(`[SSR] ${Math.min(offset+batchSize,routes.length)}/${routes.length} completed`);
}
const finalize=Bun.spawn([...nodeArgs,'--finalize'],{cwd:root,env:process.env,stdout:'inherit',stderr:'inherit'});
process.exit(await finalize.exited);
