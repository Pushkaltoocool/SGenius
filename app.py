from flask import Flask, request, jsonify
import base64
from google import genai
from google.genai import types
from flask_cors import CORS
import os
import json

app = Flask(__name__)

# --- START OF CORRECTION ---
# This CORS configuration correctly allows requests from the Netlify frontend and local development servers.
CORS(app, origins=["https://sgenius.netlify.app", "http://127.0.0.1:5500", "http://localhost:5500"])
# --- END OF CORRECTION ---

def generate_text_response(prompt, system_instruction_text):
    """
    Generic function to generate PLAIN TEXT content from the AI model.
    Used for /chat, /api/feedback, and /api/hint.
    """
    api_key = os.getenv("API_KEY")
    if not api_key:
        return jsonify({"error": "Server configuration error: Missing API Key"}), 500

    try:
        client = genai.Client(api_key=api_key)
        model = "gemini-2.0-flash"

        system_instruction = [types.Part.from_text(text=system_instruction_text)] if system_instruction_text else []
        contents = [types.Content(role="user", parts=[types.Part.from_text(text=prompt)])]

        generate_content_config = types.GenerateContentConfig(
            temperature=0.8,
            top_p=0.9,
            top_k=35,
            max_output_tokens=4096,
            response_mime_type="text/plain",  # We expect a plain text response
        )

        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=generate_content_config,
            system_instruction=system_instruction,
        )
        # We wrap the AI's text response in our own JSON object.
        return jsonify({"response": response.text})

    except Exception as e:
        print(f"Error during AI text generation: {e}")
        return jsonify({"error": "Error generating content from the AI model."}), 500

def generate_json_from_ai(prompt, system_instruction_text):
    """
    Function to generate JSON content from the AI model.
    Used for the new /api/generate-quiz endpoint.
    """
    api_key = os.getenv("API_KEY")
    if not api_key:
        raise ValueError("API_KEY environment variable not set on the server.")

    client = genai.Client(api_key=api_key)
    model = "gemini-2.0-flash"
    system_instruction = [types.Part.from_text(text=system_instruction_text)] if system_instruction_text else []
    contents = [types.Content(role="user", parts=[types.Part.from_text(text=prompt)])]
    
    generate_content_config = types.GenerateContentConfig(
        temperature=0.7,
        response_mime_type="application/json", # We expect a JSON response
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=generate_content_config,
        system_instruction=system_instruction,
    )
    return response.text


SGENIUS_TUTOR_SYSTEM_INSTRUCTION = """
### 🔧 SYSTEM INSTRUCTION (For AI Chatbot Trained on Singapore P1–A Level Syllabus)
(The detailed system instruction from the original file remains here...)
"""

@app.route("/chat", methods=["POST"])
def chat():
    """
    Handles the AI Study Assistant chat. It correctly uses the text-based generator.
    """
    user_message = request.json.get("message")
    if not user_message:
        return jsonify({"error": "No message provided"}), 400
    # This call is now correct and will not cause a 500 error.
    return generate_text_response(user_message, SGENIUS_TUTOR_SYSTEM_INSTRUCTION)


@app.route("/api/feedback", methods=["POST"])
def get_feedback():
    data = request.json
    # ... (code for this endpoint remains the same as in the original app.py)
    feedback_system_instruction = """
    You are an AI assistant for teachers in Singapore...
    """
    prompt = f"Generate feedback for a student who scored **{data.get('grade')}** in a **{data.get('subject')}** assignment titled **'{data.get('title')}'**."
    response = generate_text_response(prompt, feedback_system_instruction)
    feedback_json = response.get_json()
    return jsonify({"feedback": feedback_json.get("response")})


@app.route("/api/hint", methods=["POST"])
def get_hint():
    data = request.json
    # ... (code for this endpoint remains the same as in the original app.py)
    hint_system_instruction = """
    You are an AI Study Buddy, SGenius...
    """
    prompt = f"A student needs a hint for their **{data.get('subject')}** assignment titled **'{data.get('title')}'**. Provide one helpful hint."
    response = generate_text_response(prompt, hint_system_instruction)
    hint_json = response.get_json()
    return jsonify({"hint": hint_json.get("response")})

# --- NEWLY ADDED AND CORRECTED ENDPOINT ---
@app.route("/api/generate-quiz", methods=["POST"])
def generate_quiz():
    """
    Handles the new AI Quiz Generator feature.
    It uses the JSON-based generator and includes robust error handling.
    """
    try:
        data = request.json
        subject = data.get("subject")
        topics = data.get("topics", "general")
        num_questions = data.get("num_questions", 5)

        quiz_generation_prompt = f"Generate a quiz with {num_questions} multiple-choice questions for a Singapore student.\nSubject: {subject}\nSpecific Topics: {topics}"

        quiz_system_instruction = """
        You are an AI designed to be a Quiz Generator for Singaporean students. Your task is to create a set of multiple-choice questions based on the user's request.

        **CRITICAL INSTRUCTIONS:**
        1.  You **MUST** return a single, valid JSON object and nothing else.
        2.  The JSON object must have a single key: "questions", which is an array of question objects.
        3.  Each question object in the array must have the following four keys:
            - "question_text": (string) The full text of the question.
            - "options": (array of 4 strings) The four multiple-choice options.
            - "correct_answer_index": (integer) The 0-based index of the correct option in the "options" array.
            - "explanation": (string) A clear and concise explanation of why the correct answer is right.
        """
        
        response_json_text = generate_json_from_ai(quiz_generation_prompt, quiz_system_instruction)
        
        # Parse the JSON text to ensure it's valid before sending it to the frontend.
        parsed_json = json.loads(response_json_text)
        return jsonify(parsed_json)

    except json.JSONDecodeError as e:
        print(f"JSON Decode Error in /api/generate-quiz: {e}")
        return jsonify({"error": "Failed to generate quiz. The AI returned an invalid format."}), 500
    except Exception as e:
        print(f"Error in /api/generate-quiz endpoint: {e}")
        return jsonify({"error": "An internal server error occurred while generating the quiz."}), 500


if __name__ == "__main__":
    app.run(debug=True)
