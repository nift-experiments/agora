import { readFile,writeFile,mkdir,readdir,rm,stat } from 'node:fs/promises';
import { resolve,join,dirname,relative } from 'node:path';
const root=resolve(import.meta.dir,'..');const app=join(root,'app');const generated=join(root,'.generated');
const manifestPath=join(app,'public/__nift/content-manifest.json');
const env={VITE_DOCS_REGION:process.env.VITE_DOCS_REGION??'global'};
const readJson=async(path:string,fallback:any)=>JSON.parse(await readFile(path,'utf8').catch(()=>JSON.stringify(fallback)));
async function files(dir:string):Promise<string[]>{const entries=await readdir(dir,{withFileTypes:true}).catch(()=>[]);return (await Promise.all(entries.map(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]))).flat().sort();}
// Metadata shortcuts cover both sides: deletion or edits to an output must
// invalidate the copy, even if its maintained source has not changed.
const cachePath=join(generated,'asset-copy-state.json');
const previous=await readJson(cachePath,{});const next:Record<string,any>={};
async function identity(path:string){
 const value=await stat(path).catch(()=>null);
 return value ? [value.dev,value.ino,value.size,value.mtimeMs,value.ctimeMs] : null;
}
async function copyChanged(source:string,destination:string){
 const key=relative(root,source);const sourceIdentity=await identity(source);
 if(!sourceIdentity)throw new Error(`Missing asset source: ${source}`);
 const destinationIdentity=await identity(destination);
 const record={source:sourceIdentity,destination:destinationIdentity};
 if(destinationIdentity && JSON.stringify(previous[key])===JSON.stringify(record)){next[key]=record;return;}
 const bytes=await readFile(source);
 if(!await readFile(destination).then(old=>old.equals(bytes)).catch(()=>false)){
  await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes);
 }
 next[key]={source:sourceIdentity,destination:await identity(destination)};
}
const expected=new Set<string>();
for (const base of [join(app,'dist/client'), join(app,'public')]) {
  for (const source of await files(base)) {
    const path = relative(base,source);
    if (path === '__nift/content-metadata.json' || path === '__nift/content-heads.json' || path.startsWith('__nift/metadata/')) continue; // server-only catalog
    if (path.startsWith('__nift/content/')) continue; // copy reachable modules below
    if (base.endsWith('dist/client') && !path.startsWith('assets/') && path !== 'index.html') continue;
    expected.add(path);
    await copyChanged(source,join(root,'public',path));
  }
}
const manifest = await readJson(manifestPath, {});
for (const url of new Set(Object.values(manifest) as string[])){expected.add(url.slice(1));await copyChanged(join(app,'public',url.slice(1)),join(root,'public',url.slice(1)));}
const spa = await readFile(join(app,'dist/client/index.html'),'utf8');
await mkdir(join(generated,'html',env.VITE_DOCS_REGION === 'cn' ? 'zh-CN' : 'en'),{recursive:true});
for (const path of ['index.html','404.html',`${env.VITE_DOCS_REGION === 'cn' ? 'zh-CN' : 'en'}/index.html`]) {
 const target=join(generated,'html',path);
 if (await readFile(target,'utf8').catch(()=>null)!==spa) { await mkdir(dirname(target),{recursive:true});await writeFile(target,spa); }
}

const reachable=new Set((Object.values(manifest) as string[]).map(url=>url.split('/').at(-1)));
for(const name of await readdir(join(root,'public/__nift/content')))if(!reachable.has(name))await rm(join(root,'public/__nift/content',name));
await rm(join(root,'public/__nift/content-metadata.json'),{force:true});
console.log('Published maintained assets and reachable content modules');

for(const path of await files(join(generated,'html')))expected.add(relative(join(generated,'html'),path));
for(const path of await files(join(root,'public')))if(!expected.has(relative(join(root,'public'),path)))await rm(path);

const cacheBytes=JSON.stringify(next);
if(await readFile(cachePath,'utf8').catch(()=>null)!==cacheBytes)await writeFile(cachePath,cacheBytes);
