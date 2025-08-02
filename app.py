from flask import Flask, request, jsonify
import os
from flask_cors import CORS
import google.generativeai as genai # CORRECTED IMPORT

app = Flask(__name__)
CORS(app, origins=["https://sgenius.netlify.app", "http://127.0.0.1:5500", "http://localhost:5500"])


# --- START OF CORRECTION ---
# This function is completely updated to use the modern google-generativeai SDK syntax
def generate_response(prompt, system_instruction_text):
    """Generic function to generate content from the AI model."""
    api_key = os.getenv("API_KEY")
    if not api_key:
        return jsonify({"error": "Server configuration error: Missing API Key"}), 500

    try:
        # Configure the library with the API key
        genai.configure(api_key=api_key)

        # Create the generative model with the system instruction
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_instruction_text
        )
        
        # Set the generation configuration
        generation_config = genai.types.GenerationConfig(
            temperature=0.8,
            top_p=0.9,
            top_k=35,
            max_output_tokens=4096,
        )

        # Generate content
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        
        return jsonify({"response": response.text})

    except Exception as e:
        # We now print the specific error to the logs for better debugging
        print(f"Error during AI generation: {e}")
        return jsonify({"error": "Error generating content from the AI model."}), 500
# --- END OF CORRECTION ---


SGENIUS_TUTOR_SYSTEM_INSTRUCTION = """
### 🔧 SYSTEM INSTRUCTION (For AI Chatbot Trained on Singapore P1–A Level Syllabus)
(Your detailed system instruction remains here...)
"""

@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json.get("message")
    if not user_message:
        return jsonify({"error": "No message provided"}), 400
    return generate_response(user_message, SGENIUS_TUTOR_SYSTEM_INSTRUCTION)


@app.route("/api/feedback", methods=["POST"])
def get_feedback():
    data = request.json
    subject = data.get("subject")
    grade = data.get("grade")
    title = data.get("title")

    feedback_system_instruction = """
    You are an AI assistant for teachers in Singapore. Your role is to generate constructive, encouraging, and specific feedback for a student's assignment based on their grade. The feedback should be aligned with the Singapore MOE syllabus.
    (Your detailed system instruction remains here...)
    """
    prompt = f"Generate feedback for a student who scored **{grade}** in a **{subject}** assignment titled **'{title}'**."
    response = generate_response(prompt, feedback_system_instruction)
    feedback_json = response.get_json()
    return jsonify({"feedback": feedback_json.get("response")})


@app.route("/api/hint", methods=["POST"])
def get_hint():
    data = request.json
    subject = data.get("subject")
    title = data.get("title")

    hint_system_instruction = """
    You are an AI Study Buddy, SGenius. Your task is to give a helpful hint for an assignment without giving away the direct answer. Your hint should guide the student's thinking process.
    (Your detailed system instruction remains here...)
    """
    prompt = f"A student needs a hint for their **{subject}** assignment titled **'{title}'**. Provide one helpful hint."
    response = generate_response(prompt, hint_system_instruction)
    hint_json = response.get_json()
    return jsonify({"hint": hint_json.get("response")})


if __name__ == "__main__":
    app.run(debug=True)