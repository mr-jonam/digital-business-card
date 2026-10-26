import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { profile, inquiry, publicUrl, publishedSnapshot } from '../src/validation.js';
import { vcard, qr } from '../src/contact.js';
import { equal, encrypt, decrypt } from '../src/security.js';
import { loadConfig } from '../src/config.js';

export const fixture={first_name:'Alex',last_name:'Example',title:'Quality Engineering',company:'Example Studio',recipient:'private@example.org',phone:'+393331234567',links:[{kind:'linkedin',label:'LinkedIn',description:'Profilo professionale',url:'https://www.linkedin.com/in/example/'}],appearance:{theme:'graphite'}};

test('Partial SMTP configuration fails instead of silently disabling delivery',()=>{
  const base={DATABASE_URL:'mysql://localhost/example',SESSION_SECRET:'x'.repeat(64)};
  assert.equal(loadConfig(base).smtp,null);
  assert.throws(()=>loadConfig({...base,SMTP_HOST:'smtp.example.org'}),/SMTP incompleto/);
  assert.throws(()=>loadConfig({...base,SMTP_PORT:'bad'}),/SMTP_PORT/);
});
test('Public snapshots and contact formats exclude private email; UTF-8 folding remains valid',async()=>{
  const snapshot=publishedSnapshot(profile(fixture),1);
  assert.equal(snapshot.recipient,undefined);
  const text=vcard({...snapshot,title:'Qualità · '+ 'è'.repeat(110)},'https://cards.example.org/c/abc');
  assert.ok(!text.includes(fixture.recipient));assert.ok(!text.includes('EMAIL:'));
  assert.ok(text.startsWith('BEGIN:VCARD\r\nVERSION:3.0'));
  for(const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line)<=75);
  assert.ok(text.replace(/\r\n /g,'').includes('è'.repeat(110)));
  for(const mode of ['page','contact']) {
    const png=await qr(snapshot,'https://cards.example.org/c/abc',mode,'png');
    const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height);
    assert.ok(decoded,`QR ${mode} independently decoded`);
    assert.ok(mode==='page'?decoded.data==='https://cards.example.org/c/abc':decoded.data.startsWith('BEGIN:VCARD'));
    assert.ok(!decoded.data.includes(fixture.recipient));
  }
});
test('Validation rejects unsafe links, header injection and empty callback',()=>{
  for(const value of ['javascript:alert(1)','http://example.org','https://localhost','https://127.0.0.1','https://user:pass@example.org','https://example.org:123']) assert.throws(()=>publicUrl(value));
  assert.throws(()=>profile({...fixture,recipient:'x@example.org\r\nBcc:attacker@example.org'}));
  assert.throws(()=>inquiry({kind:'callback',email:'',phone:''}));
  assert.throws(()=>inquiry({kind:'callback',phone:'3331234567'}));
  assert.equal(inquiry({kind:'callback',phone:'+393331234567'}).phone,'+393331234567');
  assert.equal(equal('é','a'),false);assert.equal(equal('abc','abc'),true);
  const secret='s'.repeat(64),value=encrypt('TOP-SECRET',secret);
  assert.equal(decrypt(value,secret),'TOP-SECRET');assert.throws(()=>decrypt(value,'t'.repeat(64)));
});
