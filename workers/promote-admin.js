import { spawnSync } from 'node:child_process';
const email=process.argv[2];
if(!email||! /^[^\s'@]+@[^\s'@]+\.[^\s'@]+$/.test(email)){console.error('用法: npm run admin:promote -- your@email.example');process.exit(1);}
if(process.argv.length>3){console.error('此命令仅支持本地数据库，不执行云端操作');process.exit(1);}
const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','story-users','--local','--config','workers/wrangler.jsonc','--command',`UPDATE users SET role='admin' WHERE email='${email.toLowerCase()}'; SELECT id,username,email,role FROM users WHERE email='${email.toLowerCase()}';`],{stdio:'inherit'});
process.exit(result.status??1);
