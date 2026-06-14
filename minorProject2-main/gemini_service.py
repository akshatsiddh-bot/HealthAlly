import os
import json
from groq import Groq
from dotenv import load_dotenv
import models

load_dotenv()

client = None
api_key = os.getenv('GROQ_API_KEY')
if api_key:
    client = Groq(api_key=api_key)

# --- 1. DUMMY ML FUNCTION (Replace with your real one) ---
def predict_with_my_ml_model(symptoms_list):
    print(f"DEBUG: Running ML Model on: {symptoms_list}")
    return "Viral Fever" 

# --- 2. SYSTEM PROMPT ---
# We instruct the AI to ALWAYS use JSON. 
# If chatting: {"status": "CHAT", "message": "..."}
# If ready:    {"status": "ML_PREDICT", "symptoms": [...]}
SYSTEM_PROMPT_TEMPLATE = """
You are HealthAlly, a medical assistant talking to {USER_NAME}.

**INSTRUCTIONS:**
You must ALWAYS output valid JSON.

**SCENARIO 1: GATHERING SYMPTOMS (The Interview)**
- If you have fewer than 3 symptoms, keep asking questions.
- Output JSON format:
  {{"status": "CHAT", "message": "Your question here..."}}

**SCENARIO 2: READY FOR DIAGNOSIS**
- If you have 3+ distinct symptoms, DO NOT ASK MORE.
- Output JSON format:
  {{"status": "ML_PREDICT", "symptoms": ["symptom1", "symptom2", "symptom3"]}}

**SCENARIO 3: REFUSAL**
- If asked about non-medical topics, output:
  {{"status": "CHAT", "message": "I apologize, I can only discuss health. Do you have any symptoms?"}}

"""

def generate_response(chat_id, user_message, user_name="User"):
    try:
        if not client: return "Error: Server config."

        # -- STEP A: Build History --
        db_messages = models.get_chat_history(chat_id)
        history_payload = [{"role": "system", "content": SYSTEM_PROMPT_TEMPLATE.replace("{USER_NAME}", user_name)}]
        
        for msg in db_messages[-50:]:
            role = "assistant" if msg['role'] == "model" else "user"
            history_payload.append({"role": role, "content": msg['content']})
        
        history_payload.append({"role": "user", "content": user_message})

        # -- STEP B: Get JSON Response from LLM --
        chat_completion = client.chat.completions.create(
            messages=history_payload,
            model="llama-3.3-70b-versatile",
            temperature=0.5,
            max_tokens=1024,
            response_format={"type": "json_object"} # FORCE JSON
        )
        
        raw_response = chat_completion.choices[0].message.content
        
        # -- STEP C: PARSE THE JSON (THE FIX) --
        try:
            response_data = json.loads(raw_response)
            
            # CASE 1: SIGNAL TO RUN ML MODEL
            if response_data.get("status") == "ML_PREDICT":
                symptoms = response_data.get("symptoms", [])
                
                # 1. Run YOUR ML Model
                predicted_disease = predict_with_my_ml_model(symptoms)
                
                # 2. Feed result back to AI to generate final report
                final_instruction = f"""
                        SYSTEM UPDATE: The ML model predicted: '{predicted_disease}'.

                        Please generate a professional medical report. 
                        CRITICAL: Use double newlines between every section to ensure the layout is airy and not congested. Also give remedies and tips in bullet points.

                        Structure your response exactly like this:

                        ### 🩺 Medical Assessment
                        **Predicted Condition:** {predicted_disease}  
                        **Recommended Specialist:** [Specialist Name]

                        ### 🏠 Home Remedies
                        [up to you general remedies related to the condition in bullet points]

                        ### 💡 Health Tips
                        [up to you general tips related to the condition in bullet points]

                        """
                
                # Append the hidden JSON logic to history so the AI knows what happened
                history_payload.append({"role": "assistant", "content": raw_response})
                history_payload.append({"role": "system", "content": final_instruction})
                
                final_completion = client.chat.completions.create(
                    messages=history_payload,
                    model="llama-3.3-70b-versatile",
                    temperature=0.7 
                )
                
                final_text_reply = final_completion.choices[0].message.content
                
                # Save & Return
                models.save_message(chat_id, "user", user_message)
                models.save_message(chat_id, "model", final_text_reply)
                return final_text_reply

            # CASE 2: NORMAL CHAT (EXTRACT MESSAGE)
            else:
                # The AI returned {"status": "CHAT", "message": "How are you?"}
                # We only want "How are you?"
                clean_message = response_data.get("message", "I didn't understand that.")
                
                models.save_message(chat_id, "user", user_message)
                models.save_message(chat_id, "model", clean_message)
                return clean_message

        except json.JSONDecodeError:
            # Fallback: If AI failed to give JSON, just return raw text
            return raw_response

    except Exception as e:
        print(f"ERROR: {e}")
        return "I apologize, I am having technical trouble."