(() => {
"use strict";
const cfg=window.APP_CONFIG||{}, $=s=>document.querySelector(s);
const slots=["GK","LB","CB1","CB2","RB","DMF","CMF","AMF","LWF","CF","RWF"];
const slotLabels={GK:"GK",LB:"LB",CB1:"CB",CB2:"CB",RB:"RB",DMF:"DMF",CMF:"CMF",AMF:"AMF",LWF:"LWF",CF:"CF",RWF:"RWF"};
const selected={filter:{},sell:{}};
let activeContext="filter",activeSlot=null,searchTimer=null,listingsCache=[];
const status=(el,msg)=>{el.textContent=msg};
if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY){status($("#listingCount"),"Supabase ulanishi sozlanmagan.");return;}
const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>new Intl.NumberFormat("uz-UZ").format(Number(v)||0)+" so‘m";
function updateFormation(context){
 const map=context==="filter"?"#filterFormation":"#sellFormation";
 document.querySelectorAll(map+" .mini-slot").forEach(btn=>{
  const key=btn.dataset.slot,p=selected[context][key];
  btn.classList.toggle("filled",!!p);
  btn.innerHTML=p?'<b>'+esc(p.name.slice(0,9))+'</b><small>'+esc(slotLabels[key])+'</small>':'<b>+</b><small>'+esc(slotLabels[key])+'</small>';
  btn.title=p?p.name+" — almashtirish yoki olib tashlash":"Futbolchi tanlash";
 });
 const n=Object.keys(selected[context]).length;
 const el=$(context==="filter"?"#selectedCount":"#sellSelectedCount");if(el)el.textContent=n+"/11";
}
function openPicker(context,slot){
 activeContext=context;activeSlot=slot;$("#modalTitle").textContent=slotLabels[slot]+" pozitsiyasiga futbolchi tanlash";
 $("#playerSearch").value="";$("#playerResults").innerHTML='<p class="muted">Futbolchi ismini yozing.</p>';
 $("#playerModal").classList.add("open");$("#playerModal").setAttribute("aria-hidden","false");$("#playerSearch").focus();
}
function closePicker(){$("#playerModal").classList.remove("open");$("#playerModal").setAttribute("aria-hidden","true");}
document.querySelectorAll(".mini-formation").forEach(el=>el.addEventListener("click",e=>{
 const btn=e.target.closest(".mini-slot");if(!btn)return;const context=el.id==="sellFormation"?"sell":"filter";openPicker(context,btn.dataset.slot);
}));
$("#closeModal").addEventListener("click",closePicker);
$("#playerModal").addEventListener("click",e=>{if(e.target.dataset.close)closePicker();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePicker();});
async function searchPlayers(term){
 if(term.length<2){$("#playerResults").innerHTML='<p class="muted">Kamida 2 ta harf yozing.</p>';return;}
 $("#playerResults").innerHTML='<p class="muted">Qidirilmoqda…</p>';
 const {data,error}=await db.from("players").select("external_id,name,registered_position").ilike("search_name","%"+term.replace(/[%_]/g,"")+"%").order("name").limit(30);
 if(error){$("#playerResults").innerHTML='<p class="muted">Qidiruv xatosi: '+esc(error.message)+'</p>';return;}
 if(!data?.length){$("#playerResults").innerHTML='<p class="muted">Futbolchi topilmadi.</p>';return;}
 $("#playerResults").innerHTML=data.map(p=>'<div class="player-result"><div><strong>'+esc(p.name)+'</strong><small>'+esc(p.registered_position||"Pozitsiya yo‘q")+' · ID '+esc(p.external_id)+'</small></div><button type="button" data-player-id="'+esc(p.external_id)+'" data-player-name="'+esc(p.name)+'" data-player-position="'+esc(p.registered_position||"")+'">Tanlash</button></div>').join("");
}
$("#playerSearch").addEventListener("input",()=>{clearTimeout(searchTimer);const term=$("#playerSearch").value.trim();searchTimer=setTimeout(()=>searchPlayers(term),280);});
$("#playerResults").addEventListener("click",e=>{
 const b=e.target.closest("button[data-player-id]");if(!b)return;
 selected[activeContext][activeSlot]={id:String(b.dataset.playerId),name:b.dataset.playerName,position:b.dataset.playerPosition};
 updateFormation(activeContext);closePicker();
});
function selectedIds(context){return Object.values(selected[context]).map(p=>p.id);}
function selectedNames(players){return Object.values(players).map(p=>p.name);}
function listingCard(item){
 const players=Array.isArray(item.player_ids)?item.player_ids:[];
 const chips=players.slice(0,8).map(p=>'<span class="player-chip">'+esc(p.name||"Player")+'</span>').join("");
 const photo=item.photo_url?'<img src="'+esc(item.photo_url)+'" alt="Akkaunt rasmi" loading="lazy" referrerpolicy="no-referrer">':'⚽';
 const username=String(item.telegram_username||"").replace(/^@/,"");
 const desc=String(item.description||"").slice(0,130);
 return '<article class="listing-card"><div class="listing-photo">'+photo+'</div><div class="listing-body"><h3>'+esc(item.title)+'</h3><div class="price">'+money(item.price_uzs)+'</div><p class="listing-description">'+esc(desc||"Sotuvchi qo‘shimcha ma’lumot kiritmagan.")+'</p>'+(chips?'<div class="player-chips">'+chips+'</div>':'')+'<div class="listing-actions"><a class="primary" href="https://t.me/'+encodeURIComponent(username)+'" target="_blank" rel="noopener">Sotuvchiga yozish ↗</a><a href="https://t.me/wxetg" target="_blank" rel="noopener">Garant ↗</a></div></div></article>';
}
async function loadListings(){
 $("#listingCount").textContent="E’lonlar yuklanmoqda…";$("#listings").innerHTML='<div class="empty-state">Yuklanmoqda…</div>';
 const {data,error}=await db.from("account_listings").select("id,title,price_uzs,description,telegram_username,photo_url,player_ids,created_at").eq("status","approved").order("created_at",{ascending:false}).limit(150);
 if(error){$("#listingCount").textContent="E’lonlarni yuklashda xatolik";$("#listings").innerHTML='<div class="empty-state">Marketplace jadvali hali sozlanmagan yoki ulanishda xatolik bor. Supabase uchun SQL sozlamasini bajaring.</div>';console.error(error);return;}
 listingsCache=data||[];applyListingFilters();
}
function applyListingFilters(){
 const min=Number($("#minPrice").value)||0,max=Number($("#maxPrice").value)||Infinity,sort=$("#sortPrice").value;
 const wanted=selectedIds("filter");
 let rows=listingsCache.filter(x=>Number(x.price_uzs)>=min&&Number(x.price_uzs)<=max);
 if(wanted.length)rows=rows.filter(x=>{const ids=(Array.isArray(x.player_ids)?x.player_ids:[]).map(p=>String(p.id));return wanted.every(id=>ids.includes(id));});
 if(sort==="low")rows.sort((a,b)=>a.price_uzs-b.price_uzs);
 else if(sort==="high")rows.sort((a,b)=>b.price_uzs-a.price_uzs);
 else rows.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 $("#listingCount").textContent=rows.length+" ta akkaunt";
 $("#listings").innerHTML=rows.length?rows.map(listingCard).join(""):'<div class="empty-state">Bu filtrlarga mos tasdiqlangan akkaunt topilmadi. Boshqa futbolchi yoki narxni tanlab ko‘ring.</div>';
}
$("#applyFilters").addEventListener("click",applyListingFilters);
$("#minPrice").addEventListener("input",applyListingFilters);$("#maxPrice").addEventListener("input",applyListingFilters);$("#sortPrice").addEventListener("change",applyListingFilters);
$("#resetFilters").addEventListener("click",()=>{$("#minPrice").value="";$("#maxPrice").value="";$("#sortPrice").value="newest";Object.keys(selected.filter).forEach(k=>delete selected.filter[k]);updateFormation("filter");applyListingFilters();});
$("#refreshListings").addEventListener("click",loadListings);
$("#listingForm").addEventListener("submit",async e=>{
 e.preventDefault();const btn=$("#submitListing"),msg=$("#formStatus");
 const username=$("#sellerTelegram").value.trim().replace(/^@/,"");
 if(!/^[A-Za-z0-9_]{5,32}$/.test(username)){status(msg,"Telegram username noto‘g‘ri. Masalan: @username");return;}
 const price=Number($("#listingPrice").value);if(!Number.isFinite(price)||price<=0){status(msg,"Narxni to‘g‘ri kiriting.");return;}
 const payload={title:$("#listingTitle").value.trim(),price_uzs:Math.round(price),description:$("#listingDescription").value.trim(),telegram_username:username,photo_url:$("#listingPhoto").value.trim()||null,player_ids:slots.filter(s=>selected.sell[s]).map(s=>({id:selected.sell[s].id,name:selected.sell[s].name,position:slotLabels[s],registered_position:selected.sell[s].position})),status:"pending"};
 btn.disabled=true;btn.textContent="Yuborilmoqda…";status(msg,"E’lon yuborilmoqda…");
 const {error}=await db.from("account_listings").insert(payload);
 btn.disabled=false;btn.textContent="E’lonni moderatsiyaga yuborish ↗";
 if(error){console.error(error);status(msg,"Yuborilmadi: "+error.message+" — avval Supabase SQL sozlamasini bajaring.");return;}
 status(msg,"E’lon qabul qilindi! Admin tekshiruvidan keyin saytda ko‘rinadi.");
 e.target.reset();slots.forEach(s=>delete selected.sell[s]);updateFormation("sell");
});
updateFormation("filter");updateFormation("sell");loadListings();
})();