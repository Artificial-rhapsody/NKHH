import { scryptSync,randomBytes,timingSafeEqual } from 'node:crypto';
// OWASP scrypt minimum: N=2^17, r=8, p=1; 128MiB working set is unsafe in Workers.
// Use the lower-memory N=2^15,r=8,p=3 (32MiB) profile; exercised in actual workerd.
const options={N:32768,r:8,p:3,maxmem:64*1024*1024};
export async function hashPassword(password,salt=randomBytes(16).toString('hex')) {
 return {salt,hash:scryptSync(password,salt,32,options).toString('hex')};
}
export async function verifyPassword(password,salt,hash) {
 const candidate=(await hashPassword(password,salt)).hash;
 return /^[a-f0-9]{64}$/.test(hash)&&timingSafeEqual(Buffer.from(candidate,'hex'),Buffer.from(hash,'hex'));
}
