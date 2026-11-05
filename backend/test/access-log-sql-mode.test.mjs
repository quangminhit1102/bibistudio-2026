import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import mysql from 'mysql2/promise';
import {createDatabaseFixture} from './helpers/database.mjs';
import {archiveFixture,accessLogLine} from './helpers/access-logs.mjs';
import {migrateAccessLogs} from '../dist/access-logs/schema.js';
import {syncAccessLogs} from '../dist/access-logs/sync-service.js';
import {createAccessLogReadService} from '../dist/access-logs/read-service.js';
async function fixture(t){
  const f=await createDatabaseFixture(t),a=await archiveFixture(t);await migrateAccessLogs(f.pool,resolve('backend/access-log-migrations'));
  a.config.currentDirectory=join(a.root,'current');await mkdir(a.config.currentDirectory);await writeFile(join(a.config.currentDirectory,a.config.domainAlias),'');
  const seed=async request=>{const line=accessLogLine({request});await a.write([line]);await writeFile(join(a.config.currentDirectory,a.config.domainAlias+'-ssl_log'),Buffer.concat([line,Buffer.from('\n')]));};
  const pool=mysql.createPool({...f.config,connectionLimit:1,dateStrings:true,timezone:'Z'});t.after(()=>pool.end());
  await pool.query("SET SESSION sql_mode=CONCAT(@@sql_mode,',NO_BACKSLASH_ESCAPES')");
  const sync=target=>syncAccessLogs({pool:target,config:a.config,clock:f.clock,signal:AbortSignal.timeout(10000)});
  return {...f,...a,pool,seed,sync,normalPool:f.pool};
}
test('literal quotes in log paths are imported safely with NO_BACKSLASH_ESCAPES enabled',async t=>{
  const f=await fixture(t);await f.seed("GET /products/it's-a-book HTTP/1.1");
  const result=await f.sync(f.pool);assert.equal(result.state,'complete');assert.equal(result.inserted,1);assert.equal(result.current.records,1);
  for(const scope of ['archive','current'])assert.equal((await createAccessLogReadService(f.pool,f.clock,scope).list({page:1,pageSize:20,search:''})).items[0].pathname,"/products/it's-a-book");
});
test('search values remain literal and pagination bounded with NO_BACKSLASH_ESCAPES',async t=>{
  const f=await fixture(t);await f.seed('GET /products/a HTTP/1.1');assert.equal((await f.sync(f.normalPool)).state,'complete');
  for(const scope of ['archive','current']){
    const result=await createAccessLogReadService(f.pool,f.clock,scope).list({page:1,pageSize:20,search:"') OR 1=1 -- "});
    assert.equal(result.total,0);assert.equal(result.items.length,0);
  }
});
