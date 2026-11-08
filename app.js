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
})();