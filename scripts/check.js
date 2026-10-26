import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import ejs from 'ejs';
for (const folder of ['src','scripts','public','test']) {
  for (const name of await readdir(folder)) {
    if (!name.endsWith('.js')) continue;
    const result=spawnSync(process.execPath,['--check',`${folder}/${name}`],{stdio:'inherit'});
    if(result.status) process.exit(result.status);
  }
}
for (const name of await readdir('views')) if(name.endsWith('.ejs')) ejs.compile(await readFile(`views/${name}`,'utf8'),{filename:`views/${name}`});
console.log('JavaScript syntax and EJS templates verified.');
