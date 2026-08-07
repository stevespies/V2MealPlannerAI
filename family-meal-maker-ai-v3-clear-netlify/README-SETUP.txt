FAMILY MEAL MAKER AI — SIMPLE NETLIFY SETUP

IMPORTANT
This is no longer just a static HTML site. It includes Netlify Functions so your
OpenAI API key stays private. Do NOT use a plain drag-and-drop static deployment
for this version if you want the AI features.

EASIEST DEPLOYMENT — GITHUB + NETLIFY

1. Create a new GitHub repository, for example:
   family-meal-maker

2. Upload the CONTENTS of this folder to the repository, preserving:
   index.html
   netlify.toml
   README-SETUP.txt
   netlify/functions/ai-chef.js
   netlify/functions/ai-recipe.js
   netlify/functions/food-photo.js

3. In Netlify:
   Add new project -> Import an existing project -> GitHub
   Select the family-meal-maker repository.

4. Netlify should read netlify.toml automatically.
   There is no framework build step required.

5. In Netlify go to:
   Project configuration -> Environment variables

   Add:
   OPENAI_API_KEY = your OpenAI API key

   Optional:
   OPENAI_MODEL = gpt-5-mini
   OPENAI_IMAGE_MODEL = gpt-image-1-mini

6. Trigger a new deploy after adding the environment variable.

7. Open the site and go to Meal Plan.
   You should see:
   "AI Chef connected — ready to invent meals."

WHAT THE AI VERSION DOES

- Builds a new family meal plan from the actual pantry.
- Uses food marked "use first".
- Learns Love / Okay / Nope meal ratings.
- Remembers recent dinners to reduce repetition.
- Respects family-wide and individual dislikes.
- Treats allergies / medical dietary requirements as hard constraints in prompts.
- Plans cold school lunches and can use a nut-free school setting.
- Generates a full recipe only when you open a meal.
- Generates an exact AI food photo only when you request it.
- Creates a shopping list for missing ingredients.
- Keeps a built-in fallback planner if the AI connection is unavailable.

WHY RECIPES AND PHOTOS ARE ON-DEMAND

A full AI week can contain more than twenty meal slots. Generating detailed
instructions and a custom image for every option before you decide whether you
want it wastes API usage. This build first creates the plan, then finishes only
the recipes and food photos you actually open/keep.

DATA

Pantry items, likes, dislikes, ratings and recent-meal memory are stored locally
in the browser on that device. AI planning requests are sent through your own
Netlify Function to OpenAI.

FOOD SAFETY

This is a convenience meal-planning tool, not a medical or food-safety authority.
For allergies, always check ingredient labels, cross-contamination warnings,
school policies and professional advice relevant to your family.


HOW TO PROVE AI IS REALLY WORKING (V3)

1. Go to Meal Plan.
2. Press "Test AI now".
3. It must show:
   ✓ REAL AI TEST PASSED
   and a timestamp/model.
4. Press "BUILD A NEW AI WEEK".
5. The plan must show:
   CURRENT PLAN: ✓ REAL AI
   plus "AI CREATED" on each AI-generated meal card.
6. A newly built AI week is explicitly told not to reuse exact meal names
   from the current/previous plan.

If it says OFFLINE DEMO, the meals are not AI-generated.
This version will not silently substitute the fallback planner when you press
the AI build button.
