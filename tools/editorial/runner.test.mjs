import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cli=fileURLToPath(new URL('./runner.mjs',import.meta.url));
test('prepare/resume, record, integrity, no overwrite',()=>{
  const root=mkdtempSync(join(tmpdir(),'pdd-journal-'));
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
  try {
    const input=join(root,'input.md'),response=join(root,'response.md'),meta=join(root,'meta.json');
    writeFileSync(input,'Test candidate');writeFileSync(response,'Fixture only');writeFileSync(meta,JSON.stringify({execution:'mock',costUsd:null}));
    const p=run('prepare','ep04','review',input,root);assert.equal(p.status,0,p.stderr);
    const job=p.stdout.trim();assert.equal(run('prepare','ep04','review',input,root).stdout.trim(),job);
    assert.equal(JSON.parse(run('list','ep04',root).stdout)[0].status,'pending');
    assert.equal(run('record',job,response,meta).status,0);
    assert.equal(JSON.parse(run('list','ep04',root).stdout)[0].execution,'mock');
    assert.equal(JSON.parse(readFileSync(join(job,'result','receipt.json'))).costUsd,null);
    assert.notEqual(run('record',job,response,meta).status,0);
    writeFileSync(join(job,'prompt.md'),'tampered');assert.notEqual(run('list','ep04',root).status,0);
    assert.notEqual(run('prepare','ep09','review',input,root).status,0);
  } finally {rmSync(root,{recursive:true,force:true});}
});
