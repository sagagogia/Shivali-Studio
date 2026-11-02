import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Snapshot } from './types.ts';
export interface State extends Snapshot { paths:Record<string,string>; reservations:Record<string,{campaignId:string;cents:number;settled:boolean}>; }
export function dataDir(){const p=resolve(/*turbopackIgnore: true*/ process.env.SHIVALI_DATA_DIR||'.studio-data');mkdirSync(p,{recursive:true,mode:0o700});return p;}
export function transaction<T>(fn:(state:State)=>T):T {const db=new DatabaseSync(resolve(dataDir(),'studio.sqlite'));db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)');db.exec('BEGIN IMMEDIATE');try{const row=db.prepare('SELECT data FROM state WHERE id=1').get() as {data:string}|undefined;const state:State=row?JSON.parse(row.data):{garments:[],campaigns:[],assets:[],approvals:[],jobs:[],sources:[],events:[],integrations:[],paths:{},reservations:{}};const result=fn(state);db.prepare('INSERT INTO state(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(state));db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}}
