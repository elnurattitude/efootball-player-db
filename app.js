(() => {
"use strict";
const $=s=>document.querySelector(s);
let files=[],worker=null;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function status(t){$("#uploadStatus").textContent=t;}
$("#uploadArea").addEventListener("click",()=>$("#squadFiles").click());
$("#squadFiles").addEventListener("change",e=>addFiles([...e.target.files||[]]));
function addFiles(incoming){
 const accepted=incoming.filter(f=>/^image\/(png|jpeg|webp)$/.test(f.type)&&f.size<=15*1024*1024);
 if(accepted.length!==incoming.length)status("Faqat PNG, JPG, WEBP va 15 MB gacha bo‘lgan rasmlar qabul qilinadi.");
 accepted.forEach(file=>{if(!files.some(x=>x.name===file.name&&x.size===file.size))files.push(file);});
 renderFiles();if(files.length)status(files.length+" ta skrinshot yuklashga tayyor.");
}
function renderFiles(){
 $("#previewList").innerHTML=files.map((f,i)=>'<div class="preview-item"><img src="'+URL.createObjectURL(f)+'" alt="Skrinshot '+(i+1)+'"><div><b>'+esc(f.name)+'</b><small>'+(f.size/1024/1024).toFixed(1)+' MB</small></div><button type="button" data-remove-file="'+i+'" aria-label="Rasmni olib tashlash">×</button></div>').join("");
 $("#analyzeBtn").disabled=!files.length;
}
$("#previewList").addEventListener("click",e=>{const b=e.target.closest("[data-remove-file]");if(!b)return;files.splice(Number(b.dataset.removeFile),1);renderFiles();status(files.length?files.length+" ta rasm qoldi.":"Rasmlar olib tashlandi.");});
$("#analyzeBtn").addEventListener("click",async()=>{
 if(!files.length)return;
 const btn=$("#analyzeBtn");btn.disabled=true;btn.textContent="Rasmlar o‘qilmoqda…";$("#resultsSection").hidden=false;
 try{
  if(!window.Tesseract)throw new Error("OCR kutubxonasi yuklanmadi. Internetni tekshirib, sahifani yangilang.");
  if(!worker)worker=await Tesseract.createWorker("eng");
  const all=[];
  for(let i=0;i<files.length;i++){
   status((i+1)+"/"+files.length+" rasm o‘qilmoqda: "+files[i].name);
   const result=await worker.recognize(files[i]);
   all.push("===== "+files[i].name+" =====\n"+(result.data.text||""));
  }
  const text=all.join("\n\n");
  $("#allText").value=text;
  const merged=text.toLowerCase();
  $("#startingText").value=extractSection(text,["starting xi","starting lineup","lineup","game plan","first team"]);
  $("#benchText").value=extractSection(text,["bench","substitutes","substitute"]);
  $("#reserveText").value=extractSection(text,["reserve","reserves"]);
  $("#managerText").value=extractSection(text,["manager","coach"]);
  $("#recognizedCount").textContent=files.length+" IMAGES";
  status("Tahlil tugadi. OCR matnini tekshiring va kerakli bo‘limlarga ajrating.");
  $("#resultsSection").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(err){console.error(err);status("Tahlil xatosi: "+(err.message||"Noma’lum xato"));}
 finally{btn.disabled=false;btn.textContent="Rasmlarni qayta tahlil qilish";}
});
function extractSection(text,keywords){
 const lines=text.split(/\r?\n/),hits=[];
 lines.forEach((line,i)=>{const s=line.trim();if(keywords.some(k=>s.toLowerCase().includes(k)))hits.push(lines.slice(Math.max(0,i-1),Math.min(lines.length,i+7)).join("\n"));});
 return [...new Set(hits)].join("\n---\n");
}
$("#allText").addEventListener("input",()=>{});
$("#prepareBtn").addEventListener("click",()=>{
 const sections=[["Asosiy tarkib",$("#startingText").value],["Bench / zaxira",$("#benchText").value],["Reserve",$("#reserveText").value],["Murabbiy",$("#managerText").value]];
 const counts=sections.map(([name,value])=>({name,count:value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).length}));
 $("#summaryCounts").innerHTML=counts.map(x=>'<div><b>'+x.count+'</b><small>'+esc(x.name)+'</small></div>').join("");
 $("#reviewPanel").hidden=false;$("#reviewStatus").textContent="Ma’lumotlar ushbu brauzer oynasida jamlandi. Hech qayerga yuborilmadi.";
 $("#reviewPanel").scrollIntoView({behavior:"smooth",block:"nearest"});
});
})();