const ALLOWED_ORIGIN = "https://elnurattitude.github.io";
const MODEL = "gemini-3.5-flash";
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const cors = {"Access-Control-Allow-Origin":ALLOWED_ORIGIN,"Access-Control-Allow-Methods":"POST, GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});}
export default {async fetch(request,env){
 const origin=request.headers.get("Origin")||"";
 const url=new URL(request.url);
 // Health check is intentionally readable in a normal browser tab (no Origin header).
 if(request.method==="GET"&&url.pathname==="/")return json({service:"eFOOT TACTICS AI",status:"ready",model:MODEL,apiKeyConfigured:Boolean(env.GEMINI_API_KEY)});
 if(request.method==="OPTIONS"){
  if(origin!==ALLOWED_ORIGIN)return new Response("Forbidden",{status:403});
  return new Response(null,{status:204,headers:cors});
 }
 if(origin!==ALLOWED_ORIGIN)return new Response("Forbidden",{status:403});
 if(request.method!=="POST"||url.pathname!=="/analyze")return json({error:"Endpoint topilmadi."},404);
 if(!env.GEMINI_API_KEY)return json({error:"Serverda GEMINI_API_KEY secret sozlanmagan."},500);
 if(Number(request.headers.get("Content-Length")||0)>MAX_BODY_BYTES)return json({error:"So‘rov 8 MB limitdan oshdi."},413);
 try{
  const rawBody=await request.text();
  if(new TextEncoder().encode(rawBody).byteLength>MAX_BODY_BYTES)return json({error:"So‘rov 8 MB limitdan oshdi."},413);
  let input;
  try{input=JSON.parse(rawBody);}catch{return json({error:"JSON so‘rovi noto‘g‘ri."},400);}
  if(!Array.isArray(input.images)||input.images.length<1||input.images.length>6)return json({error:"1–6 ta rasm yuborish mumkin."},400);
  const prompt=`You are an expert eFootball squad screenshot analyst and tactical coach. Analyze ONLY supplied screenshots and optional OCR text. Do not use or claim access to an external player database. Identify visible player cards, names, positions, overall ratings, card types, playing styles, manager name and manager/team playstyle only when legible. Never invent uncertain names, ratings, positions, stats or manager details. Use null or "unknown" for uncertain fields and low confidence. Distinguish detected current formation/playstyle from recommendations. Recommend a practical formation and Team Playstyle based on confirmed players and visible positions. If evidence is insufficient, say so and keep advice provisional. Return ONLY valid JSON with this structure:
{"overview":"Uzbek summary","manager":{"name":null,"playstyle":null,"confidence":"low","notes":""},"formation_detected":null,"team_playstyle_detected":null,"players":[{"name":"","position":"","rating":null,"card_type":"","playing_style":"","screenshot_section":"","confidence":"low","notes":""}],"recommended_formation":"","recommended_team_playstyle":"","tactical_setup":{"attacking_style":"","build_up":"","attacking_area":"","positioning":"","defensive_style":"","containment_area":"","pressuring":"","defensive_line":""},"player_roles":[{"position":"","player_name":"","reason":""}],"key_strengths":[],"weaknesses":[],"changes_to_make":[],"uncertainties":[]}
Write explanations in Uzbek. Keep player names as shown in-game. Do not guess unreadable fields.`;
  const parts=[{text:prompt}];
  for(const image of input.images){
   if(typeof image.data!=="string"||image.data.length<100||image.data.length>2800000||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.data))return json({error:"Rasm ma’lumoti juda katta yoki noto‘g‘ri."},400);
   if(!["image/jpeg","image/png","image/webp"].includes(image.mimeType))return json({error:"Faqat JPEG, PNG yoki WEBP."},400);
   parts.push({text:"Screenshot section: "+String(image.section||"unknown")+"; filename: "+String(image.name||"image")});
   parts.push({inline_data:{mime_type:image.mimeType,data:image.data}});
  }
  if(input.ocr)parts.push({text:"Optional OCR text for cross-checking only; may contain errors: "+JSON.stringify(input.ocr).slice(0,12000)});
  const upstream=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+MODEL+":generateContent?key="+encodeURIComponent(env.GEMINI_API_KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{temperature:.2,responseMimeType:"application/json",maxOutputTokens:8192}})});
  const raw=await upstream.json().catch(()=>({}));
  if(!upstream.ok)return json({error:raw.error?.message||"Gemini API so‘rovi bajarilmadi."},upstream.status===429?429:502);
  const responseText=raw.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";
  if(!responseText){
   const reason=raw.candidates?.[0]?.finishReason||raw.promptFeedback?.blockReason||"unknown";
   return json({error:"Gemini javobi bo‘sh yoki bloklandi. Sabab: "+reason},502);
  }
  let analysis;try{analysis=JSON.parse(responseText);}catch{return json({error:"AI javobi JSON formatida emas. Qayta urinib ko‘ring."},502);}
  return json({analysis,model:MODEL});
 }catch(error){return json({error:error?.message||"Server xatosi."},500);}
}};
