/* auto-uploaded 2026-07-12T18:13:52.237Z */
(function(){
async function lookup(w){if(!w)return null;var c=cGet(w);if(c){console.log(TAG,'快取',w);return c}var K=getKeys();if(!K.length){console.warn(TAG,'無 key');return null}for(var i=0;i<K.length;i++){if(isCool(i)){console.log(TAG,'跳過冷卻 '+(i+1));continue}for(var m=0;m<MODELS.length;m++){var md=MODELS[m];console.log(TAG,'查:'+w+' key'+(i+1)+' '+md);try{var r=await call(w,K[i],i,md);cSet(w,r);console.log(TAG,'OK '+w+' ('+md+')');return r}catch(e){if(e.message==='RATE_LIMIT')break;if(e.message==='MODEL_404')continue;console.warn(TAG,md+' 失敗:'+e.message)}await new Promise(function(x){setTimeout(x,CGAP)})}}console.warn(TAG,w+' 全失敗');return null}
async function batch(ws){if(!Array.isArray(ws)||!ws.length)return{};var R={},T=ws.length;var todo=[];for(var i=0;i<ws.length;i++){var c=cGet(ws[i]);if(c)R[ws[i]]=c;else todo.push(ws[i])}console.log(TAG,'快取命中 '+(T-todo.length)+'/'+T);var f=0;for(var j=0;j<todo.length;j++){var r=await lookup(todo[j]);if(r){R[todo[j]]=r;f=0}else{f++;if(f>=3){console.warn(TAG,'中斷批次');break}}await new Promise(function(x){setTimeout(x,BGAP)})}return R}
window.lookupWordWithGemini = lookup;
window.batchLookupWithGemini = batch;
console.log("[GeminiLookup] ready (from base64)");
})();