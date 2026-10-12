import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword,verifyPassword } from '../workers/src/password.js';
test('salted passwords verify and never store plaintext',async()=>{
 const result=await hashPassword('test-password-long');
 assert.notEqual(result.hash,'test-password-long');
 assert.equal(await verifyPassword('test-password-long',result.salt,result.hash),true);
 assert.equal(await verifyPassword('wrong',result.salt,result.hash),false);
 const second=await hashPassword('test-password-long');
 assert.notEqual(result.salt,second.salt);
});
