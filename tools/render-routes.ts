import { readFile, mkdir, writeFile, readdir, rm, access } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createStaticRouteHtml } from '../app/src/lib/static-route-html';
const root = resolve(import.meta.dir, '..');
const app = join(root, 'app');
process.chdir(app);
process.env.NIFT_CONTENT_ROOT = join(app, 'public');
process.env.TSS_CLIENT_OUTPUT_DIR = join(app, 'public');
const json = async (path: string, fallback?: any) => JSON.parse(await readFile(path,'utf8').catch(error => {if(fallback!==undefined)return JSON.stringify(fallback);throw error;}));
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const seoPages = await json(join(app,'public/__static/docs-seo.json'));
const seoByUrl = new Map(seoPages.map((page:any)=>[page.url,page]));
const routes = await json(join(app,'public/__static/docs-routes.json'));
const canonical = new Map(routes.map((route:any)=>[route.url,route.canonicalPath]));
const pages = [...seoPages,...routes.filter((route:any)=>!seoByUrl.has(route.url)).map((route:any)=>({url:route.url,alias:true}))];
const args=process.argv.slice(2);const force=args.includes('--all');const explicit=args.filter(arg=>!arg.startsWith('--'));
const planArg=args.find(arg=>arg.startsWith('--plan-file='));
const planPath=planArg?.slice('--plan-file='.length);
const usePlan=Boolean(planPath&&!args.includes('--plan'));
const output=join(root,'.generated/html');const statePath=join(root,'.generated/render-state.json');const old=await json(statePath,{});let next:any={};
let selected:any[]=[];
// Worker lifetimes remain bounded; only dependency planning is shared.
if(usePlan){
 const plan=await json(planPath!);
 next=plan.next;
 selected=explicit.length?plan.selected.filter((page:any)=>explicit.includes(page.url)):plan.selected;
 if(explicit.length&&selected.length!==explicit.length)throw new Error('SSR worker routes do not match prepared plan');
}else{
 const manifest=await json(join(app,'public/__nift/content-manifest.json'));
 const bundle=createHash('sha256');
 for(const base of ['dist/server/assets','dist/client/assets'])for(const file of (await readdir(join(app,base))).sort()){bundle.update(file);bundle.update(await readFile(join(app,base,file)));}
 bundle.update(await readFile(join(app,'dist/server/server.js')));bundle.update(process.env.NODE_ENV??'');bundle.update(process.env.SITE_URL??'https://docs.agora.io');const bundleHash=bundle.digest('hex');
 for(const page of pages){
  if(explicit.length&&!explicit.includes(page.url))continue;
  const path=(canonical.get(page.url)??page.url) as string;const parts=path.split('/').filter(Boolean);
  let payload=await json(join(app,'public/__static/docs',parts.length===2?path.slice(1)+'/index.json':path.slice(1)+'.json'));
  const redirectInputs:any[]=[];
  for(let depth=0;payload.redirectUrl&&depth<10;depth++){
   redirectInputs.push(payload);
   const target=new URL(payload.redirectUrl,process.env.SITE_URL??'https://docs.agora.io').pathname;
   const canonicalTarget=(canonical.get(target)??target) as string;const targetParts=canonicalTarget.split('/').filter(Boolean);
   payload=await json(join(app,'public/__static/docs',targetParts.length===2?canonicalTarget.slice(1)+'/index.json':canonicalTarget.slice(1)+'.json'));
  }
  const contentPaths=new Set<string>();
  function collect(value:any){if(typeof value==='string'&&manifest[value])contentPaths.add(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect);}
  collect(payload.body);if(payload.contentPath)collect(payload.contentPath);
  const fingerprint=hash(bundleHash+JSON.stringify(page)+JSON.stringify(payload)+(redirectInputs.length?JSON.stringify(redirectInputs):'')+[...contentPaths].sort().map(p=>manifest[p]).join(''));
  next[page.url]=fingerprint;
  if(force||explicit.length||old[page.url]!==fingerprint||!await access(join(output,page.url.slice(1),'index.html')).then(()=>true,()=>false))selected.push(page);
 }
}
async function finalize(){
 for(const page of pages)if(!await access(join(output,page.url.slice(1),'index.html')).then(()=>true,()=>false))throw new Error(`Missing completed SSR output: ${page.url}`);
 for(const path of Object.keys(old))if(!(path in next)){
  await rm(join(output,path.slice(1),'index.html'),{force:true});
  await rm(join(root,'public',path.slice(1),'index.html'),{force:true});
 }
 const value=JSON.stringify(next)+'\n';
 if(await readFile(statePath,'utf8').catch(()=>null)!==value)await writeFile(statePath,value);
}
if(args.includes('--plan')){
 if(planPath)await writeFile(planPath,JSON.stringify({selected,next})+'\n');
 // Even a clean plan must retire removed routes and refresh its dependency state.
 if(!selected.length&&!explicit.length)await finalize();
 console.log(JSON.stringify(selected.map((page:any)=>page.url)));process.exit(0);
}
if(selected.length && !args.includes('--finalize')){
 const server=(await import(pathToFileURL(join(app,'dist/server/server.js')).href)).default;
 const spaHtml=await readFile(join(app,'dist/client/index.html'),'utf8');
 let count=0;
 for(const page of selected){
  let url=(process.env.SITE_URL??'https://docs.agora.io')+page.url;
  let response=await server.fetch(new Request(url,{headers:{'User-Agent':'NiftPrerenderBot/1.0'}}));
  for(let depth=0;response.status>=300&&response.status<400&&response.headers.get('location')&&depth<10;depth++){
   url=new URL(response.headers.get('location')!,url).href;
   response=await server.fetch(new Request(url,{headers:{'User-Agent':'NiftPrerenderBot/1.0'}}));
  }
  if(!response.ok)throw new Error(`SSR failed ${page.url}: ${response.status}`);
  const responseHtml=await response.text();
  const finalPage=page.alias?seoByUrl.get(new URL(url).pathname):page;
  if(!finalPage)throw new Error(`Alias target has no SEO page: ${page.url} -> ${url}`);
  const validated=createStaticRouteHtml({page:finalPage as any,routeHtml:responseHtml,spaHtml});
  const html=page.alias?responseHtml:validated;
  const filename=join(output,page.url.slice(1),'index.html');
  await mkdir(dirname(filename),{recursive:true});
  if(await readFile(filename,'utf8').catch(()=>null)!==html)await writeFile(filename,html);
  if(++count%100===0)console.log(`Rendered ${count}/${selected.length}`);
 }
}
if(args.includes('--finalize')||(!explicit.length&&!usePlan))await finalize();
console.log(JSON.stringify({rendered:args.includes('--finalize')?0:selected.length,total:pages.length,output}));
