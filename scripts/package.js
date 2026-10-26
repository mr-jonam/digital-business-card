import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const output=new URL('../dist/',import.meta.url);
await mkdir(output,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const staging=new URL(`digital-card-app-${stamp}/`,output);
await mkdir(staging);
// An explicit allowlist excludes .env, databases, uploads, private branding and caches.
for (const name of ['src','views','public','migrations','deploy','package.json','package-lock.json','.env.example','README.md','LICENSE','NOTICE','LICENSE-DECISION.md','THIRD-PARTY-NOTICES.md','.provenance','docs/UBUNTU-DEPLOY.md']) {
  await access(new URL(`../${name}`,import.meta.url));
  const target=new URL(name,staging);
  await mkdir(new URL('./',target),{recursive:true});
  await cp(new URL(`../${name}`,import.meta.url),target,{recursive:true});
}
const {fileURLToPath}=await import('node:url');
const archive=fileURLToPath(new URL('digital-card-app.tar.gz',output));
const result=spawnSync('tar',['-czf',archive,'-C',fileURLToPath(staging),'.'],{stdio:'inherit'});
if(result.status!==0)throw new Error('tar is unavailable: upload the contents of dist/digital-card-app-* with WinSCP.');
const hash=createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(archive+'.sha256',`${hash}  digital-card-app.tar.gz\n`);
console.log(`Package ready: ${archive}\nSHA-256: ${hash}`);
