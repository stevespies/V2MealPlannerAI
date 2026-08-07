const MEAL_SCHEMA = {
  type:"object", additionalProperties:false,
  required:["id","dayIndex","day","mealType","name","time","servings","description","reason","tags"],
  properties:{
    id:{type:"string"}, dayIndex:{type:"integer"}, day:{type:"string"},
    mealType:{type:"string",enum:["school","lunch","dinner","snack"]},
    name:{type:"string"}, time:{type:"integer"}, servings:{type:"integer"},
    description:{type:"string"}, reason:{type:"string"},
    tags:{type:"array",items:{type:"string"}}
  }
};

const WEEK_SCHEMA = {
  type:"object", additionalProperties:false,
  required:["weekTitle","summary","meals","smartSuggestions"],
  properties:{
    weekTitle:{type:"string"}, summary:{type:"string"},
    meals:{type:"array",items:MEAL_SCHEMA},
    smartSuggestions:{type:"array",items:{type:"string"}}
  }
};

const SWAP_SCHEMA = {
  type:"object", additionalProperties:false, required:["meal"],
  properties:{meal:MEAL_SCHEMA}
};

const SHOPPING_SCHEMA = {
  type:"object", additionalProperties:false, required:["shopping"],
  properties:{
    shopping:{type:"array",items:{
      type:"object",additionalProperties:false,
      required:["category","item","amount","forMeals"],
      properties:{
        category:{type:"string"}, item:{type:"string"}, amount:{type:"string"},
        forMeals:{type:"array",items:{type:"string"}}
      }
    }}
  }
};

function outputText(data){
  if(typeof data.output_text === "string") return data.output_text;
  const bits=[];
  for(const item of data.output||[]) for(const c of item.content||[]) if(c.type==="output_text"&&c.text) bits.push(c.text);
  return bits.join("");
}

async function openaiStructured(input,schema,name,maxOutputTokens=5000){
  const key=process.env.OPENAI_API_KEY;
  if(!key) throw new Error("OPENAI_API_KEY is not configured in Netlify.");
  const requestedModel=process.env.OPENAI_MODEL||"gpt-5-mini";
  const body={
    model:requestedModel,
    store:false,
    reasoning:{effort:"minimal"},
    max_output_tokens:maxOutputTokens,
    input,
    text:{verbosity:"low",format:{type:"json_schema",name,strict:true,schema}}
  };
  const r=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const raw=await r.text();
  let data;
  try{ data=JSON.parse(raw); }
  catch{ throw new Error(`OpenAI returned an unexpected non-JSON response (${r.status}).`); }
  if(!r.ok) throw new Error(data?.error?.message||`OpenAI request failed (${r.status}).`);
  const text=outputText(data);
  if(!text) throw new Error("OpenAI returned no structured text.");
  let parsed;
  try{ parsed=JSON.parse(text); }
  catch{ throw new Error("OpenAI returned malformed structured output."); }
  return {data:parsed,meta:{ai:true,model:data.model||requestedModel,responseId:data.id||"",generatedAt:new Date().toISOString()}};
}

async function openaiPing(){
  const key=process.env.OPENAI_API_KEY;
  if(!key) throw new Error("OPENAI_API_KEY is not configured in Netlify.");
  const requestedModel=process.env.OPENAI_MODEL||"gpt-5-mini";
  const body={model:requestedModel,store:false,reasoning:{effort:"minimal"},max_output_tokens:30,input:"Reply with exactly: AI_CONNECTED"};
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const raw=await r.text();
  let data; try{data=JSON.parse(raw)}catch{throw new Error(`OpenAI live test returned non-JSON (${r.status}).`)}
  if(!r.ok) throw new Error(data?.error?.message||"OpenAI live test failed.");
  const text=outputText(data).trim();
  if(!text) throw new Error("OpenAI live test returned no text.");
  return {ok:true,reply:text,_meta:{ai:true,model:data.model||requestedModel,responseId:data.id||"",generatedAt:new Date().toISOString()}};
}

function jsonResponse(status,obj){
  return {statusCode:status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"},body:JSON.stringify(obj)};
}

exports.handler=async(event)=>{
  if(event.httpMethod==="GET") return jsonResponse(200,{connected:!!process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||"gpt-5-mini",version:"v4-lean"});
  if(event.httpMethod!=="POST") return jsonResponse(405,{error:"Method not allowed"});
  try{
    const p=JSON.parse(event.body||"{}");
    if(p.action==="test") return jsonResponse(200,await openaiPing());

    const family=`PANTRY: ${JSON.stringify(p.pantry||[])}\nUSE FIRST: ${JSON.stringify(p.useSoon||[])}\nLIKES: ${JSON.stringify(p.likes||[])}\nDISLIKES: ${JSON.stringify(p.dislikes||[])}\nINDIVIDUAL PEOPLE: ${JSON.stringify(p.people||[])}\nSETTINGS: ${JSON.stringify(p.settings||{})}\nMEAL RATINGS: ${JSON.stringify(p.ratings||[])}\nRECENT DINNERS TO AVOID REPEATING: ${JSON.stringify(p.recentMeals||[])}`;

    if(p.action==="shopping"){
      const plan=(p.currentPlan||[]).map(x=>({day:x.day,mealType:x.mealType,name:x.name,description:x.description||""}));
      const input=`Create a concise Australian supermarket shopping list for this family meal plan.\nSubtract foods already listed in PANTRY where reasonable. Prioritise USE FIRST foods instead of buying duplicates. Group items into Fruit & veg, Meat, Dairy & eggs, Pantry & bakery, Frozen, or Other. Combine duplicate ingredients into one practical approximate quantity for the week. Do not include pantry basics such as salt, pepper, cooking oil or water unless the meal genuinely depends on a specialty version.\nPLAN: ${JSON.stringify(plan)}\n${family}\nReturn only the structured shopping list.`;
      const result=await openaiStructured(input,SHOPPING_SCHEMA,"family_week_shopping",3200);
      return jsonResponse(200,{...result.data,_meta:result.meta});
    }

    if(p.action==="swap"){
      const input=`You are the private family meal-planning engine for an Australian household. Replace exactly one meal in the current plan with a genuinely different option. Respect allergies as hard constraints and dislikes as strong preferences. Prefer pantry and USE FIRST items. For school food, obey the schoolMode and keep it realistic eaten cold. Avoid rejected meals and recent repeats. Use Australian English and normal supermarket ingredients.\nThe replacement MUST keep dayIndex=${p.replace?.dayIndex}, day=${p.replace?.day}, mealType=${p.replace?.mealType}.\nDo not simply rename the old meal; change cuisine, texture or format.\nOLD MEAL: ${JSON.stringify(p.replace)}\nCURRENT PLAN NAMES: ${JSON.stringify((p.currentPlan||[]).map(x=>x.name))}\n${family}\nReturn only the structured replacement meal.`;
      const result=await openaiStructured(input,SWAP_SCHEMA,"family_meal_swap",1200);
      return jsonResponse(200,{...result.data,_meta:result.meta});
    }

    if(p.action!=="week") return jsonResponse(400,{error:"Unknown action"});

    const days=Number(p.settings?.days||7);
    const schoolMode=p.settings?.schoolMode||"nut-free";
    const expected=days*3 + (schoolMode==="none"?0:Math.min(days,5));
    const previous=(p.previousPlan||[]).map(x=>x.name);
    const input=`You are the private family meal-planning engine for an Australian household. Build a practical ${days}-day meal plan for ${p.settings?.servings||5} people.\nFor every day include lunch, dinner and snack. Monday-Friday also include a school lunch unless schoolMode is \"none\". That should produce about ${expected} meal entries.\nThe family often buys chicken breast and beef mince, but make the week feel genuinely varied. Turn familiar proteins into different cuisines and formats, and add sensible other proteins or meat-free meals when useful.\nDinner maximum cook time: ${p.settings?.maxTime||45} minutes.\nAllergies/medical dietary requirements are HARD constraints. Dislikes are strong preferences. If schoolMode is nut-free, do not include nuts or nut products in school lunches/snacks and never make allergen-safety guarantees.\nSchool lunches must be realistic eaten cold and packable. Use leftovers intelligently if enabled, but not for every lunch.\nPrefer PANTRY and USE FIRST ingredients. Ratings matter: love = learn the style; nope = avoid that meal and close variants.\nPREVIOUS PLAN MEAL NAMES: ${JSON.stringify(previous)}\nThis is explicitly a NEW week: do not reuse exact meal names from the previous plan. With high variety, change cuisine or format as well.\nKeep each description and reason to ONE short sentence. Do NOT output ingredient lists or cooking steps in this call; those are generated only when the user opens a recipe.\nUse Australian English. Give each meal a short id using letters, numbers and hyphens.\n${family}\nReturn only the structured lean meal plan.`;
    const result=await openaiStructured(input,WEEK_SCHEMA,"family_meal_week_lean",5200);
    return jsonResponse(200,{...result.data,_meta:result.meta});
  }catch(e){
    console.error(e);
    return jsonResponse(500,{error:e.message||"AI planning failed"});
  }
};
