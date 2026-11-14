#!/usr/bin/env node
// Minimal append-only prepare/record journal. No provider/API dependencies.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, renameSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const roles = new Set(['write', 'review', 'edit', 'materials']);
const hash = b => createHash('sha256').update(b).digest('hex');
const json = x => JSON.stringify(x, null, 2) + '\n';
const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
const writeNew = (p, b) => writeFileSync(p, b, {flag:'wx'});
const fail = message => { throw new Error(message); };
function episode(value) {
  if (!/^ep0[1-8]$/.test(value ?? '')) fail('Expected ep01–ep08');
  return value;
}
function checkJob(path) {
  const meta = readJson(join(path,'request.json'));
  for (const [name, expected] of Object.entries(meta.files)) {
    if (hash(readFileSync(join(path,name))) !== expected) fail(`Changed input: ${name}`);
  }
  return meta;
}
function prepare(ep, role, input, root) {
  episode(ep);
  if (!roles.has(role)) fail('Unknown role');
  const inputs = readFileSync(resolve(input));
  const instruction = readFileSync(join(here,'roles',`${role}.md`));
  const prompt = Buffer.concat([instruction, Buffer.from('\n\n---\n\n# Входные материалы\n\n'), inputs]);
  const files = {'input.md': hash(inputs), 'role.md': hash(instruction), 'prompt.md': hash(prompt)};
  const id = `${role}-${hash(json({ep,role,files})).slice(0,20)}`;
  const parent = resolve(root,ep,'jobs');
  const path = join(parent,id);
  mkdirSync(parent,{recursive:true});
  if (existsSync(path)) {
    checkJob(path);
    return path;
  }
  // Publish a complete directory, not a partly written request.
  const tmp = join(parent,`.${id}-${process.pid}.tmp`);
  mkdirSync(tmp);
  try {
    writeNew(join(tmp,'input.md'),inputs);
    writeNew(join(tmp,'role.md'),instruction);
    writeNew(join(tmp,'prompt.md'),prompt);
    writeNew(join(tmp,'request.json'),json({id,episode:ep,role,files,createdAt:new Date().toISOString()}));
    renameSync(tmp,path);
  } catch (e) {
    rmSync(tmp,{recursive:true,force:true});
    throw e;
  }
  return path;
}
function record(path, response, metaFile) {
  path = resolve(path);
  const request = checkJob(path);
  if (existsSync(join(path,'result'))) fail('Response already recorded; use a new input for a new job.');
  const raw = readFileSync(resolve(response));
  if (!raw.toString('utf8').trim()) fail('Empty response');
  const metadata = metaFile ? readJson(resolve(metaFile)) : {};
  if (!['live','manual-independent','mock','unknown'].includes(metadata.execution ?? 'unknown')) fail('Invalid execution');
  if (metadata.costUsd != null && (!Number.isFinite(metadata.costUsd) || metadata.costUsd < 0)) fail('Invalid costUsd');
  const tmp = join(path,`.result-${process.pid}.tmp`);
  mkdirSync(tmp);
  try {
    writeNew(join(tmp,'response.md'),raw);
    writeNew(join(tmp,'receipt.json'),json({jobId:request.id,promptSha256:request.files['prompt.md'],responseSha256:hash(raw),recordedAt:new Date().toISOString(),model:metadata.model??null,execution:metadata.execution??'unknown',costUsd:metadata.costUsd??null,notes:metadata.notes??null}));
    renameSync(tmp,join(path,'result'));
  } catch(e) { rmSync(tmp,{recursive:true,force:true}); throw e; }
  return join(path,'result');
}
function list(ep, root) {
  episode(ep);
  const dir = resolve(root,ep,'jobs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir,{withFileTypes:true}).filter(d=>d.isDirectory()&&!d.name.startsWith('.')).map(d=>{
    const path = join(dir,d.name);
    const request = checkJob(path);
    const result = join(path,'result');
    let receipt = null;
    if (existsSync(result)) {
      receipt=readJson(join(result,'receipt.json'));
      if (receipt.jobId!==request.id || receipt.promptSha256!==request.files['prompt.md'] || receipt.responseSha256!==hash(readFileSync(join(result,'response.md')))) fail(`Changed result: ${d.name}`);
    }
    return {id:request.id,role:request.role,status:receipt?'recorded':'pending',execution:receipt?.execution??null,costUsd:receipt?.costUsd??null,path};
  });
}
const [cmd,...args]=process.argv.slice(2);
try {
  if(cmd==='prepare' && args.length>=3 && args.length<=4) console.log(prepare(args[0],args[1],args[2],args[3]??'editorial-runs'));
  else if(cmd==='record' && args.length>=2 && args.length<=3) console.log(record(...args));
  else if(cmd==='list' && args.length>=1 && args.length<=2) console.log(json(list(args[0],args[1]??'editorial-runs')));
  else fail('Usage: node runner.mjs prepare ep04 review input.md [root]\n       node runner.mjs record <job-dir> response.md [metadata.json]\n       node runner.mjs list ep04 [root]');
} catch(e) { console.error(e.message); process.exitCode=1; }
