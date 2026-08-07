const RECIPE_SCHEMA={
 type:"object",additionalProperties:false,required:["recipe"],
 properties:{recipe:{type:"object",additionalProperties:false,required:["name","mealType","time","servings","description","ingredients","steps","tags","familyTip","storage","lunchboxNote"],properties:{
  name:{type:"string"},mealType:{type:"string",enum:["school","lunch","dinner","snack"]},time:{type:"integer"},servings:{type:"integer"},description:{type:"string"},
  ingredients:{type:"array",items:{type:"object",additionalProperties:false,required:["item","amount"],properties:{item:{type:"string"},amount:{type:"string"}}}},
  steps:{type:"array",items:{type:"string"}},tags:{type:"array",items:{type:"string"}},familyTip:{type:"string"},storage:{type:"string"},lunchboxNote:{type:"string"}
 }}}
};
function outputText(data){if(typeof data.output_text==="string")return data.output_text;const a=[];for(const i of data.output||[])for(const c of i.content||[])if(c.type==="output_text"&&c.text)a.push(c.text);return a.join("")}
function out(status,obj){return{statusCode:status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"},body:JSON.stringify(obj)}}
exports.handler=async(event)=>{
 if(event.httpMethod!=="POST")return out(405,{error:"Method not allowed"});
 try{
  const key=process.env.OPENAI_API_KEY;if(!key)throw new Error("OPENAI_API_KEY is not configured in Netlify.");
  const p=JSON.parse(event.body||"{}"),m=p.meal||{};
  const prompt=`Create the complete, tested-in-spirit home recipe for this planned meal:
${JSON.stringify(m)}
Family pantry: ${JSON.stringify(p.pantry||[])}
Likes: ${JSON.stringify(p.likes||[])}
Dislikes: ${JSON.stringify(p.dislikes||[])}
Allergies/medical dietary requirements: ${JSON.stringify(p.settings?.allergies||"")}
People: ${JSON.stringify(p.people||[])}
Use Australian English, metric measurements, normal supermarket ingredients, and clear numbered steps. Keep it achievable in the stated time.
Allergies are hard constraints. For packed school food, never claim allergen safety; tell the user to check ingredient labels and school rules.
For lunchboxNote, use an empty string when not relevant. Storage advice must be conservative and food-safety aware.
Return only the structured recipe.`;
  const body={model:process.env.OPENAI_MODEL||"gpt-5-mini",store:false,input:prompt,text:{format:{type:"json_schema",name:"family_recipe",strict:true,schema:RECIPE_SCHEMA}}};
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"OpenAI recipe request failed.");
  return out(200,JSON.parse(outputText(d)));
 }catch(e){console.error(e);return out(500,{error:e.message||"Recipe generation failed"})}
};