import test from 'node:test'
import assert from 'node:assert/strict'
import {assistant} from '../server/assistant.js'
function response(){return {status(n){this.code=n;return this},json(value){this.body=value;return this}}}
test('incomplete model output cannot produce a favorable match',async t=>{
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'invalid'}]}}]})}))
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test';try{
 const res=response();await assistant(true)({method:'POST',headers:{},body:{jobDescription:'edge vision engineer'}},res)
 assert.equal(res.code,503);assert.equal(res.body.matchPercentage,undefined)
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old}
})
