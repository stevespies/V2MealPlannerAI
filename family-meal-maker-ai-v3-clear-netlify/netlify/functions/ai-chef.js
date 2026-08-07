const WEEK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["weekTitle","summary","meals","shopping","smartSuggestions"],
  properties: {
    weekTitle: {type:"string"},
    summary: {type:"string"},
    meals: {
      type:"array",
      items:{
        type:"object",additionalProperties:false,
        required:["id","dayIndex","day","mealType","name","time","servings","description","reason","ingredients","tags"],
        properties:{
          id:{type:"string"},dayIndex:{type:"integer"},day:{type:"string"},
          mealType:{type:"string",enum:["school","lunch","dinner","snack"]},
          name:{type:"string"},time:{type:"integer"},servings:{type:"integer"},
          description:{type:"string"},reason:{type:"string"},
          ingredients:{type:"array",items:{type:"object",additionalProperties:false,required:["item","amount"],properties:{item:{type:"string"},amount:{type:"string"}}}},
          tags:{type:"array",items:{type:"string"}}
        }
      }
    },
    shopping:{
      type:"array",
      items:{type:"object",additionalProperties:false,required:["category","item","amount","forMeals"],properties:{
        category:{type:"string"},item:{type:"string"},amount:{type:"string"},forMeals:{type:"array",items:{type:"string"}}
      }}
    },
    smartSuggestions:{type:"array",items:{type:"string"}}
  }
};

const SWAP_SCHEMA = {
  type:"object",additionalProperties:false,required:["meal","shopping"],
  properties:{
    meal: WEEK_SCHEMA.properties.meals.items,
    shopping: WEEK_SCHEMA.properties.shopping
  }
};

function outputText(data){
  if(typeof data.output_text === "string") return data.output_text;
  const bits=[];
  for(const item of data.output||[]) for(const c of item.content||[]) if(c.type==="output_text"&&c.text) bits.push(c.text);
  return bits.join("");
}
async function openaiStructured(input,schema,name){
  const key=process.env.OPENAI_API_KEY;
  if(!key) throw new Error("OPENAI_API_KEY is not configured in Netlify.");
  const body={
    model:process.env.OPENAI_MODEL||"gpt-5-mini",
    store:false,
    input,
    text:{format:{type:"json_schema",name,strict:true,schema}}
  };
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await r.json();
  if(!r.ok) throw new Error(data?.error?.message||"OpenAI request failed.");
  const text=outputText(data);
  if(!text) throw new Error("OpenAI returned no structured text.");
  return JSON.parse(text);
}
async function openaiPing(){
  const key=process.env.OPENAI_API_KEY;
  if(!key) throw new Error("OPENAI_API_KEY is not configured in Netlify.");
  const requestedModel=process.env.OPENAI_MODEL||"gpt-5-mini";
  const body={model:requestedModel,store:false,input:"Reply with exactly: AI_CONNECTED"};
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await r.json();
  if(!r.ok) throw new Error(data?.error?.message||"OpenAI live test failed.");
  const text=outputText(data).trim();
  if(!text) throw new Error("OpenAI live test returned no text.");
  return {ok:true,reply:text,_meta:{ai:true,model:data.model||requestedModel,responseId:data.id||"",generatedAt:new Date().toISOString()}};
}
function jsonResponse(status,obj){return {statusCode:status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"},body:JSON.stringify(obj)}}

exports.handler=async(event)=>{
  if(event.httpMethod==="GET") return jsonResponse(200,{connected:!!process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||"gpt-5-mini"});
  if(event.httpMethod!=="POST") return jsonResponse(405,{error:"Method not allowed"});
  try{
    const p=JSON.parse(event.body||"{}");
    if(p.action==="test"){
      const result=await openaiPing();
      return jsonResponse(200,result);
    }
    const family=`PANTRY: ${JSON.stringify(p.pantry||[])}
USE FIRST: ${JSON.stringify(p.useSoon||[])}
LIKES: ${JSON.stringify(p.likes||[])}
DISLIKES: ${JSON.stringify(p.dislikes||[])}
INDIVIDUAL PEOPLE: ${JSON.stringify(p.people||[])}
SETTINGS: ${JSON.stringify(p.settings||{})}
MEAL RATINGS: ${JSON.stringify(p.ratings||[])}
RECENT DINNERS TO AVOID REPEATING: ${JSON.stringify(p.recentMeals||[])}`;

    if(p.action==="swap"){
      const input=`You are the private family meal-planning engine for an Australian household.
Replace exactly one meal in the current plan with a genuinely different meal.
Respect allergies as hard constraints. Dislikes are strong preferences. Nut-free school mode means do not suggest nuts or nut products, but never claim a product is allergen-safe without checking labels.
Use metric Australian kitchen conventions and ingredients commonly available in Australia.
Prefer pantry ingredients and items marked USE FIRST. Keep shopping modest. Avoid repeating recent meals and rejected meals.
The replacement MUST keep dayIndex=${p.replace?.dayIndex}, day=${p.replace?.day}, mealType=${p.replace?.mealType}.
Do not simply rename the old meal. Vary cuisine, texture or format.
CURRENT MEAL TO REPLACE: ${JSON.stringify(p.replace)}
CURRENT PLAN: ${JSON.stringify((p.currentPlan||[]).map(x=>({day:x.day,mealType:x.mealType,name:x.name})))}
${family}
Return the replacement meal plus an updated concise shopping list for the week.`;
      const data=await openaiStructured(input,SWAP_SCHEMA,"family_meal_swap");
      return jsonResponse(200,{...data,_meta:{ai:true,model:process.env.OPENAI_MODEL||"gpt-5-mini",generatedAt:new Date().toISOString()}});
    }

    const days=Number(p.settings?.days||7);
    const schoolMode=p.settings?.schoolMode||"nut-free";
    const expected = days*4 - (schoolMode==="none"?Math.min(days,5):0) - Math.max(0,days-5);
    const input=`You are the private family meal-planning engine for an Australian household.
Build a practical ${days}-day plan for ${p.settings?.servings||5} people.
For Monday-Friday include school lunch, lunch, dinner and snack unless schoolMode is "none". For weekends do NOT include school lunches.
Aim for about ${expected} meal entries total.
The family often buys chicken breast and beef mince, but DO NOT make the week repetitive. Transform proteins across cuisines and formats: wraps, rice bowls, pasta, burgers, tray bakes, stir-fries, tacos, mild curries, salads, baked items, etc. Add other sensible proteins or meat-free meals when that improves variety and budget.
Dinner maximum cook time is ${p.settings?.maxTime||45} minutes.
Respect allergies/medical dietary requirements as HARD constraints. Dislikes are strong preferences.
If schoolMode is "nut-free", do not include nuts or nut products in school lunches/snacks and remind the family to check product labels; do not make medical guarantees.
School lunches should be realistic eaten cold and packable. Prefer batchable/freezer-friendly options where useful.
Use leftovers intelligently when enabled, but do not turn every lunch into leftovers.
Prefer pantry ingredients and USE FIRST items before adding shopping.
Meal ratings matter: "love" means learn the style; "nope" means avoid that meal and close variants.
Avoid RECENT DINNERS unless repetition is clearly useful.
PREVIOUS/CURRENT PLAN: ${JSON.stringify(p.previousPlan||[])}
This request means "build a NEW week". Do not reuse exact meal names from the previous/current plan. With high variety, also change cuisine or meal format wherever possible. A familiar ingredient is fine; an identical named meal is not.
Use Australian English, metric measurements, simple ingredients available from normal Australian supermarkets.
The initial plan should include enough ingredient names/amounts to build a shopping list, but not full cooking steps. Full recipes are generated separately when opened.
Give each meal a short stable id using letters/numbers/hyphens.
${family}
Return only the structured plan.`;
    const data=await openaiStructured(input,WEEK_SCHEMA,"family_meal_week");
    return jsonResponse(200,{...data,_meta:{ai:true,model:process.env.OPENAI_MODEL||"gpt-5-mini",generatedAt:new Date().toISOString()}});
  }catch(e){
    console.error(e);
    return jsonResponse(500,{error:e.message||"AI planning failed"});
  }
};