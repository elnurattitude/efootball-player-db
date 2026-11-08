(() => {
"use strict";
const cfg=window.APP_CONFIG||{},$=s=>document.querySelector(s);
if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY){$("#uploadStatus").textContent="Supabase ulanishi sozlanmagan.";return;}
const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
let imageFile=null,players=[],worker=null;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function setStatus(message){$("#uploadStatus").textContent=message;}
$("#uploadArea").addEventListener("click",()=>$("#squadFile").click());
$("#squadFile").addEventListener("change",e=>handleFile(e.target.files?.[0]));
$("#removeImage").addEventListener("click",()=>{imageFile=null;$("#squadFile").value="";$("#previewWrap").hidden=true;$("#uploadArea").hidden=false;$("#analyzeBtn").disabled=true;setStatus("Rasm olib tashlandi.");});
function handleFile(file){
 if(!file)return;
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)){setStatus("Faqat PNG, JPG yoki WEBP rasm tanlang.");return;}
 if(file.size>12*1024*1024){setStatus("Rasm hajmi 12 MB dan kichik bo‘lishi kerak.");return;}
 imageFile=file;$("#preview").src=URL.createObjectURL(file);$("#previewWrap").hidden=false;$("#uploadArea").hidden=true;$("#analyzeBtn").disabled=false;setStatus("Rasm tayyor. Tahlil qilish tugmasini bosing.");
}
$("#analyzeBtn").addEventListener("click",async()=>{
 if(!imageFile)return;
 const btn=$("#analyzeBtn");btn.disabled=true;btn.textContent="Rasm o‘qilmoqda…";setStatus("OCR ishga tushmoqda. Bir oz kuting…");
 try{
  if(!window.Tesseract)throw new Error("OCR kutubxonasi yuklanmadi. Sahifani yangilang.");
  if(!worker)worker=await Tesseract.createWorker("eng");
  const result=await worker.recognize(imageFile);
  const raw=result.data.text||"";
  $("#ocrText").textContent=raw.trim()||"Matn aniqlanmadi. Rasm tiniqligini tekshiring yoki futbolchilarni qo‘lda qidiring.";
  $("#resultsSection").hidden=false;
  await autoFindCandidates(raw);
  setStatus("Tahlil tugadi. Topilgan futbolchilarni tekshirib, tarkibga qo‘shing.");
  $("#resultsSection").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(err){console.error(err);setStatus("Tahlil xatosi: "+(err.message||"Noma’lum xato"));}
 finally{btn.disabled=false;btn.textContent="Qayta tahlil qilish";}
});
function cleanTerm(s){return String(s||"").replace(/[^a-zA-ZÀ-ÿ' .-]/g," ").replace(/\s+/g," ").trim();}
async function lookup(term){
 const q=cleanTerm(term);if(q.length<3)return [];
 const {data,error}=await db.from("players").select("external_id,name,registered_position").ilike("search_name","%"+q.replace(/[%_]/g,"")+"%").order("name").limit(5);
 if(error){console.warn(error);return [];}return data||[];
}
async function autoFindCandidates(raw){
 const lines=raw.split(/\n/).map(cleanTerm).filter(x=>x.length>=4&&x.length<=36&&/[a-zA-Z]{3}/.test(x));
 const unique=[...new Set(lines)].slice(0,12);
 const batches=await Promise.all(unique.map(line=>lookup(line)));
 let found=batches.flat();
 const seen=new Set();found=found.filter(p=>{const id=String(p.external_id);if(seen.has(id))return false;seen.add(id);return true;}).slice(0,24);
 renderSearchResults(found,"OCR bo‘yicha ehtimoliy mosliklar");
}
function renderSearchResults(rows,label){
 const box=$("#searchResults");
 if(!rows.length){box.innerHTML='<p class="tiny muted">Mos futbolchi topilmadi. Ismini qo‘lda qidirib ko‘ring.</p>';return;}
 box.innerHTML='<p class="tiny muted">'+esc(label)+'</p>'+rows.map(p=>'<div class="player-result"><div><strong>'+esc(p.name)+'</strong><small>'+esc(p.registered_position||"Pozitsiya noma’lum")+' · ID '+esc(p.external_id)+'</small></div><button type="button" data-add="'+esc(p.external_id)+'" data-name="'+esc(p.name)+'" data-position="'+esc(p.registered_position||"")+'">Tarkibga qo‘shish</button></div>').join("");
}
$("#searchBtn").addEventListener("click",manualSearch);
$("#playerSearch").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();manualSearch();}});
async function manualSearch(){
 const term=$("#playerSearch").value.trim();if(term.length<2){$("#searchResults").innerHTML='<p class="tiny muted">Kamida 2 ta harf yozing.</p>';return;}
 $("#searchResults").innerHTML='<p class="tiny muted">Qidirilmoqda…</p>';
 const rows=await lookup(term);renderSearchResults(rows,"Qidiruv natijalari");
}
$("#searchResults").addEventListener("click",e=>{
 const b=e.target.closest("button[data-add]");if(!b)return;
 const id=String(b.dataset.add);if(players.some(p=>String(p.id)===id))return;
 if(players.length>=11){alert("Tarkibga 11 tadan ortiq futbolchi qo‘shib bo‘lmaydi.");return;}
 players.push({id,name:b.dataset.name,position:b.dataset.position});renderLineup();
});
function renderLineup(){
 $("#lineupCount").textContent=players.length+" / 11";
 $("#recognizedCount").textContent=players.length+" PLAYERS";
 $("#lineup").innerHTML=players.length?players.map((p,i)=>'<div class="lineup-player"><button class="remove-player" type="button" data-remove="'+i+'" aria-label="O‘chirish">×</button><b>'+esc(p.name)+'</b><small>'+esc(p.position||"Pozitsiya yo‘q")+'</small></div>').join(""):'<p class="muted">Hozircha futbolchi qo‘shilmagan.</p>';
 $("#recommendBtn").disabled=players.length<1;
}
$("#lineup").addEventListener("click",e=>{const b=e.target.closest("button[data-remove]");if(!b)return;players.splice(Number(b.dataset.remove),1);renderLineup();});
function positionCounts(){
 const counts={GK:0,DEF:0,MID:0,ATT:0};
 players.forEach(p=>{const x=String(p.position||"").toUpperCase();if(x.includes("GK"))counts.GK++;else if(["CB","LB","RB","LWB","RWB"].some(v=>x.includes(v)))counts.DEF++;else if(["DMF","CMF","AMF","MF"].some(v=>x.includes(v)))counts.MID++;else if(["CF","SS","LWF","RWF","FW"].some(v=>x.includes(v)))counts.ATT++;});
 return counts;
}
function buildRecommendations(){
 const c=positionCounts(),n=players.length;
 let main="4-2-1-3",reason="Ikki tayanch yarim himoyachi va uch hujumchi bilan muvozanatli boshlang‘ich variant.";
 if(c.ATT>=4&&c.MID>=3) {main="4-3-3";reason="Hujumchilar va yarim himoyachilar soni qanotlar orqali hujum qilishga mos keladi.";}
 if(c.MID>=4&&c.ATT<=2){main="4-3-2-1";reason="Yarim himoyada ko‘proq futbolchi bor; markazni zichlashtirish mumkin.";}
 const styles=[
  {name:"Quick Counter",fit:"Tezkor CF/LWF/RWF va yuqori pressingni yoqtirsangiz",detail:"Tez hujumga chiqish va raqib himoyasi ortiga yugurish."},
  {name:"Possession Game",fit:"Pas, to‘p nazorati va texnik CMF/AMF futbolchilaringiz kuchli bo‘lsa",detail:"Qisqa paslar va sabrli hujum qurilishi."},
  {name:"Long Ball Counter",fit:"Mustahkam CB/DMF va tezkor qarshi hujumchilar bo‘lsa",detail:"Himoyada ixcham turish va to‘pni qaytarib tez hujum qilish."},
  {name:"Out Wide",fit:"Kuchli LWF/RWF va hujumkor qanot himoyachilaringiz bo‘lsa",detail:"Qanotlardan foydalanish va jarima maydoniga uzatmalar."},
  {name:"Long Ball",fit:"Oldinda jismonan kuchli CF va ikkinchi to‘p uchun kurashadigan yarim himoyachilar bo‘lsa",detail:"To‘g‘ridan-to‘g‘ri uzatmalar va hujumchini tayanch sifatida ishlatish."}
 ];
 $("#tacticOutput").innerHTML='<div class="recommendation-grid"><article class="recommendation-card featured"><span class="label">FORMATION · STARTING POINT</span><h3>'+main+'</h3><p>'+reason+'</p><strong>Taxminiy tavsiya · '+n+' futbolchi kiritildi</strong></article>'+styles.map((s,i)=>'<article class="recommendation-card"><span class="label">TEAM PLAYSTYLE '+(i+1)+'</span><h3>'+s.name+'</h3><p>'+s.detail+'</p><strong>'+s.fit+'</strong></article>').join("")+'</div><p class="tiny muted" style="margin-top:14px">Cheklov: hozirgi futbolchi jadvalida asosan ism va ro‘yxatdan o‘tgan pozitsiya bor. Shu sababli bu dastlabki tavsiya; tezlik, pas, himoya ko‘rsatkichlari, individual Player Playstyle va manager proficiency qo‘shilgach, aniqroq optimizatsiya qilamiz.</p>';
 $("#recommendations").hidden=false;$("#recommendations").scrollIntoView({behavior:"smooth",block:"start"});
}
$("#recommendBtn").addEventListener("click",buildRecommendations);
renderLineup();
})();