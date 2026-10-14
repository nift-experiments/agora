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
const nodeArgs=['node','--max-old-space-size=384',join(root,'.generated/render-routes.mjs')];
// This is production SSR; Node otherwise selects React's development runtime.
const rendererEnv={...process.env,NODE_ENV:'production'};
const requested=process.argv.slice(2);
if(requested.some(arg=>arg.startsWith('/'))){
 const worker=Bun.spawn([...nodeArgs,...requested],{cwd:root,env:rendererEnv,stdout:'inherit',stderr:'inherit'});
 process.exit(await worker.exited);
}
const planPath=join(root,'.generated/render-plan.json');
const planArg=`--plan-file=${planPath}`;
const planner=Bun.spawn([...nodeArgs,'--plan',planArg,...requested],{cwd:root,env:rendererEnv,stdout:'pipe',stderr:'inherit'});
const planned=await new Response(planner.stdout).text();
if(await planner.exited)throw new Error('SSR planning failed');
const routes:string[]=JSON.parse(planned);
if(!routes.length)process.exit(0);
const batchSize=Number(process.env.NIFT_SSR_WORKER_SIZE??128);
if(!Number.isInteger(batchSize)||batchSize<1)throw new Error('Invalid SSR worker size');
const concurrency=Number(process.env.NIFT_SSR_CONCURRENCY??2);
if(!Number.isInteger(concurrency)||concurrency<1)throw new Error('Invalid SSR concurrency');
let cursor=0,completed=0,failed=false;
const active=new Set<ReturnType<typeof Bun.spawn>>();
async function consume(){
 while(!failed && cursor<routes.length){
  const offset=cursor;cursor+=batchSize;
  const selected=routes.slice(offset,offset+batchSize);
  const worker=Bun.spawn([...nodeArgs,planArg,...selected],{cwd:root,env:rendererEnv,stdout:'inherit',stderr:'inherit'});
  active.add(worker);
  const code=await worker.exited;active.delete(worker);
  if(code){failed=true;for(const child of active)child.kill();await Promise.allSettled([...active].map(child=>child.exited));throw new Error('SSR worker failed');}
  completed+=selected.length;
  console.log(`[SSR] ${completed}/${routes.length} completed`);
 }
}
await Promise.all(Array.from({length:Math.min(concurrency,Math.ceil(routes.length/batchSize))},consume));
const finalize=Bun.spawn([...nodeArgs,'--finalize',planArg],{cwd:root,env:rendererEnv,stdout:'inherit',stderr:'inherit'});
process.exit(await finalize.exited);
