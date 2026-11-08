(() => {
"use strict";
const $=s=>document.querySelector(s);
const categories=[
 {id:"startingText",label:"Asosiy tarkib / Starting XI"},
 {id:"benchText",label:"Bench / zaxira"},
 {id:"reserveText",label:"Reserve"},
 {id:"managerText",label:"Manager / murabbiy"},
 {id:"allText",label:"Faqat umumiy matn"}
];
let files=[],worker=null,busy=false;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function status(t){$("#uploadStatus").textContent=t;}
function revoke(file){if(file.url)URL.revokeObjectURL(file.url);}
function addFiles(incoming){
 const accepted=incoming.filter(f=>/^image\/(png|jpeg|webp)$/.test(f.type)&&f.size<=15*1024*1024);
 if(accepted.length!==incoming.length)status("Faqat PNG, JPG yoki WEBP va 15 MB gacha bo‘lgan rasmlar qabul qilinadi.");
 accepted.forEach(file=>{
  if(files.some(x=>x.name===file.name&&x.size===file.size))return;
  files.push({file,url:URL.createObjectURL(file),type:"unknown",text:"",done:false});
 });
 renderFiles();
 if(files.length)status(files.length+" ta skrinshot tayyor. Har birining bo‘limini belgilang.");
}
function renderFiles(){
 $("#previewList").innerHTML=files.map((item,i)=>'<div class="preview-item"><img src="'+item.url+'" alt="Skrinshot '+(i+1)+'"><div class="preview-meta"><b>'+esc(item.file.name)+'</b><small>'+(item.file.size/1024/1024).toFixed(1)+' MB · '+(item.done?"O‘qildi":"Kutilmoqda")+'</small><select data-kind="'+i+'" aria-label="Skrinshot bo‘limi"><option value="unknown" '+(item.type==="unknown"?"selected":"")+'>Bo‘limni tanlang</option><option value="starting" '+(item.type==="starting"?"selected":"")+'>Asosiy tarkib</option><option value="bench" '+(item.type==="bench"?"selected":"")+'>Bench / zaxira</option><option value="reserve" '+(item.type==="reserve"?"selected":"")+'>Reserve</option><option value="manager" '+(item.type==="manager"?"selected":"")+'>Manager / murabbiy</option><option value="all" '+(item.type==="all"?"selected":"")+'>Umumiy / boshqa</option></select></div><button type="button" data-remove-file="'+i+'" aria-label="Rasmni olib tashlash">×</button></div>').join("");
 $("#analyzeBtn").disabled=!files.length||busy;
 $("#clearFiles").hidden=!files.length;
}
$("#uploadArea").addEventListener("click",()=>$("#squadFiles").click());
$("#squadFiles").addEventListener("change",e=>{addFiles([...e.target.files]);e.target.value="";});
$("#uploadArea").addEventListener("dragover",e=>{e.preventDefault();$("#uploadArea").classList.add("drag-active");});
$("#uploadArea").addEventListener("dragleave",()=>$("#uploadArea").classList.remove("drag-active"));
$("#uploadArea").addEventListener("drop",e=>{e.preventDefault();$("#uploadArea").classList.remove("drag-active");addFiles([...e.dataTransfer.files]);});
$("#previewList").addEventListener("change",e=>{const s=e.target.closest("select[data-kind]");if(!s)return;files[Number(s.dataset.kind)].type=s.value;});
$("#previewList").addEventListener("click",e=>{const b=e.target.closest("[data-remove-file]");if(!b)return;const i=Number(b.dataset.removeFile);revoke(files[i]);files.splice(i,1);renderFiles();status(files.length?files.length+" ta rasm qoldi.":"Rasmlar olib tashlandi.");});
$("#clearFiles").addEventListener("click",()=>{files.forEach(revoke);files=[];renderFiles();status("Barcha rasmlar olib tashlandi.");});
function preprocess(file){
 return new Promise((resolve,reject)=>{
  const img=new Image();const url=URL.createObjectURL(file);
  img.onload=()=>{
   const max=2600,scale=Math.min(2.2,max/Math.max(img.naturalWidth,img.naturalHeight),1.8);
   const canvas=document.createElement("canvas");canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
   const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
   const frame=ctx.getImageData(0,0,canvas.width,canvas.height),d=frame.data;
   for(let p=0;p<d.length;p+=4){const gray=(d[p]*0.299+d[p+1]*0.587+d[p+2]*0.114);const contrast=Math.max(0,Math.min(255,(gray-128)*1.28+128));d[p]=d[p+1]=d[p+2]=contrast;}
   ctx.putImageData(frame,0,0);URL.revokeObjectURL(url);resolve(canvas);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Rasmni ochib bo‘lmadi: "+file.name));};img.src=url;
 });
}
function appendText(id,chunk){
 const el=$("#"+id);const clean=chunk.trim();if(!clean)return;
 el.value=(el.value.trim()?el.value.trim()+"\n\n":"")+clean;
}
$("#analyzeBtn").addEventListener("click",async()=>{
 if(!files.length||busy)return;
 if(files.some(x=>x.type==="unknown")){status("Davom etishdan oldin har bir skrinshot uchun bo‘limni tanlang.");return;}
 busy=true;const btn=$("#analyzeBtn");btn.disabled=true;btn.textContent="Tahlil qilinmoqda…";$("#resultsSection").hidden=false;
 try{
  if(!window.Tesseract)throw new Error("OCR moduli yuklanmadi. Internetni tekshirib sahifani yangilang.");
  if(!worker){worker=await Tesseract.createWorker("eng",1,{logger:m=>{if(m.status==="recognizing text")status("Matn aniqlanmoqda… "+Math.round((m.progress||0)*100)+"%");}});await worker.setParameters({tessedit_pageseg_mode:"11",preserve_interword_spaces:"1"});}
  const all=[];
  ["startingText","benchText","reserveText","managerText","allText"].forEach(id=>$("#"+id).value="");
  for(let i=0;i<files.length;i++){
   const item=files[i];status((i+1)+"/"+files.length+" · "+item.file.name+" o‘qilmoqda…");
   const image=await preprocess(item.file);const result=await worker.recognize(image);
   item.text=(result.data.text||"").trim();item.done=true;all.push("===== "+item.file.name+" · "+item.type+" =====\n"+item.text);
   const target={starting:"startingText",bench:"benchText",reserve:"reserveText",manager:"managerText",all:"allText"}[item.type];
   appendText(target,"["+item.file.name+"]\n"+item.text);
   renderFiles();
  }
  appendText("allText",all.join("\n\n"));
  $("#recognizedCount").textContent=files.length+" IMAGES";
  status("Tahlil tugadi. OCR matnini tekshirib, xatolarni tuzating.");
  $("#resultsSection").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(err){console.error(err);status("Tahlil xatosi: "+(err.message||"Noma’lum xato"));}
 finally{busy=false;btn.disabled=!files.length;btn.textContent="Rasmlarni qayta tahlil qilish";renderFiles();}
});
$("#prepareBtn").addEventListener("click",()=>{
 const fields=[["Asosiy tarkib",$("#startingText").value],["Bench / zaxira",$("#benchText").value],["Reserve",$("#reserveText").value],["Murabbiy",$("#managerText").value]];
 const counts=fields.map(([name,value])=>({name,count:value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).length}));
 $("#summaryCounts").innerHTML=counts.map(x=>'<div><b>'+x.count+'</b><small>'+esc(x.name)+'</small></div>').join("");
 $("#reviewPanel").hidden=false;
 $("#reviewStatus").textContent="Tekshiruv xulosasi tayyor. Ma’lumotlar faqat shu brauzer oynasida saqlanadi; serverga yuborilmadi.";
 $("#reviewPanel").scrollIntoView({behavior:"smooth",block:"nearest"});
});
window.addEventListener("beforeunload",()=>files.forEach(revoke));

/* Gemini Vision: the API key is stored only as a Cloudflare Worker secret. */
const aiEndpoint=$("#aiEndpoint"),aiConsent=$("#aiConsent"),aiButton=$("#aiAnalyzeBtn"),aiStatus=$("#aiStatus"),aiResult=$("#aiResult");
function updateAIButton(){aiButton.disabled=!(aiEndpoint.value.trim().startsWith("https://")&&aiConsent.checked&&!busy);}
aiEndpoint.addEventListener("input",updateAIButton);aiConsent.addEventListener("change",updateAIButton);
function aiMsg(t){aiStatus.textContent=t;}
function canvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("Rasmni siqib bo‘lmadi.")),"image/jpeg",.74));}
async function makeAIImage(file){
 // Vision receives a color-preserving copy; grayscale/contrast processing is reserved for OCR.
 const src=await new Promise((resolve,reject)=>{
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("Rasm ochilmadi: "+file.name));};
  img.src=url;
 });
 const scale=Math.min(1,1500/Math.max(src.naturalWidth,src.naturalHeight));
 const c=document.createElement("canvas");
 c.width=Math.max(1,Math.round(src.naturalWidth*scale));
 c.height=Math.max(1,Math.round(src.naturalHeight*scale));
 c.getContext("2d").drawImage(src,0,0,c.width,c.height);
 const blob=await canvasBlob(c);
 if(blob.size>2*1024*1024)throw Error(file.name+" hajmi 2 MB dan katta.");
 const data=await new Promise((resolve,reject)=>{
  const r=new FileReader();
  r.onload=()=>resolve(String(r.result).split(",")[1]);
  r.onerror=()=>reject(Error("Rasm o‘qilmadi."));
  r.readAsDataURL(blob);
 });
 return {name:file.name,mimeType:"image/jpeg",data};
}
function ae(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function showAI(d){
 const players=Array.isArray(d.players)?d.players:[];
 const phtml=players.map(p=>'<div class="ai-player"><b>'+ae(p.name||"Noma’lum futbolchi")+'</b><span>'+ae(p.position||"Pozitsiya noma’lum")+' · '+ae(p.rating??"—")+'</span><small>'+ae(p.card_type||"Kartasi aniqlanmadi")+' · ishonch: '+ae(p.confidence||"past")+'</small></div>').join("");
 const t=d.tactical_setup||{},thtml=Object.entries(t).map(([k,v])=>'<div class="ai-tactic"><b>'+ae(k.replaceAll("_"," "))+'</b><span>'+ae(Array.isArray(v)?v.join(", "):v)+'</span></div>').join("");
 const ul=x=>Array.isArray(x)?x.map(v=>"<li>"+ae(typeof v==="string"?v:JSON.stringify(v))+"</li>").join(""):"";
 aiResult.innerHTML='<span class="eyebrow">GEMINI VISION ANALYSIS</span><h3>AI tahlil natijasi</h3><p>'+ae(d.overview||"Tahlil yakunlandi.")+'</p>'+
 '<div class="ai-highlights"><div><small>Tavsiya etilgan sxema</small><b>'+ae(d.recommended_formation||"Aniqlanmadi")+'</b></div><div><small>Team Playstyle</small><b>'+ae(d.recommended_team_playstyle||"Aniqlanmadi")+'</b></div><div><small>Murabbiy</small><b>'+ae(d.manager?.name||"Aniqlanmadi")+'</b></div></div>'+
 '<h4>Aniqlangan futbolchilar ('+players.length+')</h4><div class="ai-player-grid">'+(phtml||'<p class="muted">Futbolchilar aniqlanmadi.</p>')+'</div>'+
 '<h4>Taktik sozlamalar</h4><div class="ai-tactics-grid">'+(thtml||'<p class="muted">Taktika qaytmadi.</p>')+'</div>'+
 '<h4>O‘zgartirish tavsiyalari</h4><ul>'+ul(d.changes_to_make)+'</ul><h4>Kuchli tomonlar</h4><ul>'+ul(d.key_strengths)+'</ul><h4>Zaif tomonlar</h4><ul>'+ul(d.weaknesses)+'</ul><h4>Aniqlik talab qiladigan joylar</h4><ul>'+ul(d.uncertainties)+'</ul>'+
 '<p class="tiny muted">AI xato qilishi mumkin. Kartalar, reytinglar va murabbiy ma’lumotlarini o‘yin ichida tekshiring.</p><details><summary>To‘liq AI javobi</summary><pre>'+ae(JSON.stringify(d,null,2))+'</pre></details>';
 aiResult.hidden=false;
}
aiButton.addEventListener("click",async()=>{
 if(busy||!files.length||!aiConsent.checked)return;
 if(files.length>6){aiMsg("Bir urinishda ko‘pi bilan 6 ta rasm yuboring.");return;}
 busy=true;aiButton.disabled=true;aiButton.textContent="AI tahlil qilmoqda…";aiResult.hidden=true;
 try{
  const images=[];
  for(let i=0;i<files.length;i++){aiMsg("Rasm tayyorlanmoqda "+(i+1)+"/"+files.length+"…");images.push({...await makeAIImage(files[i].file),section:files[i].type});}
  const body=JSON.stringify({images,ocr:{startingXI:$("#startingText").value,bench:$("#benchText").value,reserve:$("#reserveText").value,manager:$("#managerText").value}});
  if(body.length>8*1024*1024)throw Error("Yuboriladigan ma’lumot 8 MB dan oshdi. Kamroq rasm tanlang.");
  aiMsg("Gemini rasmlarni tahlil qilmoqda…");
  const res=await fetch(aiEndpoint.value.trim(),{method:"POST",headers:{"Content-Type":"application/json"},body});
  const out=await res.json().catch(()=>({error:"Serverdan noto‘g‘ri javob keldi."}));
  if(!res.ok)throw Error(out.error||("Server xatosi: "+res.status));
  if(!out.analysis)throw Error("AI javobida tahlil topilmadi.");
  showAI(out.analysis);aiMsg("AI tahlili tayyor. Natijani tekshirib chiqing.");aiResult.scrollIntoView({behavior:"smooth",block:"start"});
 }catch(e){console.error(e);aiMsg("AI xatosi: "+(e.message||"Noma’lum xato"));}
 finally{busy=false;aiButton.textContent="AI bilan qayta tahlil qilish ✦";updateAIButton();}
});

})();