function out(status,obj){return{statusCode:status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"},body:JSON.stringify(obj)}}
exports.handler=async(event)=>{
 if(event.httpMethod!=="POST")return out(405,{error:"Method not allowed"});
 try{
  const key=process.env.OPENAI_API_KEY;if(!key)throw new Error("OPENAI_API_KEY is not configured in Netlify.");
  const p=JSON.parse(event.body||"{}");
  const prompt=`Realistic appetising editorial food photograph of "${p.name}". ${p.description||""}
Visible ingredients should plausibly match: ${(p.ingredients||[]).join(", ")}.
Natural family home meal presentation, Australian everyday food, warm daylight, 45-degree camera angle, realistic portion, clean ceramic plate or bowl, no text, no labels, no hands, no people, no excessive garnish, not fine-dining, not illustration.`;
  const body={model:process.env.OPENAI_IMAGE_MODEL||"gpt-image-2",prompt,size:"1024x1024",quality:"low",output_format:"jpeg"};
  const r=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"OpenAI image request failed.");
  const b64=d?.data?.[0]?.b64_json;if(!b64)throw new Error("No image data returned.");
  return out(200,{b64,mime:"image/jpeg"});
 }catch(e){console.error(e);return out(500,{error:e.message||"Photo generation failed"})}
};