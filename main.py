from flask import Flask, request, jsonify
import os
import json
from flask_cors import CORS
import google.generativeai as genai # CORRECTED IMPORT

app = Flask(__name__)
CORS(app, origins=["https://sgenius.netlify.app", "http://127.0.0.1:5500", "http://localhost:5500"])


# --- START OF CORRECTION ---
# This function is completely updated to use the modern google-generativeai SDK syntax
def generate_ai_text(prompt, system_instruction_text):
    """Generates text using the AI model and returns the raw text."""
    api_key = os.getenv("API_KEY")
    if not api_key:
        raise ValueError("API_KEY environment variable not set on the server.")

    # Configure the library with the API key
    genai.configure(api_key=api_key)

    # Create the generative model with the system instruction
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=system_instruction_text
    )
    
    # Set the generation configuration to explicitly request JSON
    generation_config = genai.types.GenerationConfig(
        temperature=0.7,
        response_mime_type="application/json",
    )

    # Generate content
    response = model.generate_content(
        prompt,
        generation_config=generation_config
    )
    
    return response.text
# --- END OF CORRECTION ---


SGENIUS_TUTOR_SYSTEM_INSTRUCTION = """
### 🔧 SYSTEM INSTRUCTION (For AI Chatbot Trained on Singapore P1–A Level Syllabus)
(Your detailed system instruction remains here...)
"""

@app.route("/chat", methods=["POST"])
def chat():
    try:
        user_message = request.json.get("message")
        if not user_message:
            return jsonify({"error": "No message provided"}), 400
        
        # This endpoint is in main.py but seems unused in the frontend.
        # It's corrected here just in case.
        response_text = generate_ai_text(user_message, SGENIUS_TUTOR_SYSTEM_INSTRUCTION)
        return jsonify({"response": json.loads(response_text)})

    except Exception as e:
        print(f"Error in /chat endpoint: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500


@app.route("/api/generate-quiz", methods=["POST"])
def generate_quiz():
    try:
        data = request.json
        subject = data.get("subject")
        topics = data.get("topics", "general")
        num_questions = data.get("num_questions", 5)

        quiz_generation_prompt = f"""
        Generate a quiz with {num_questions} multiple-choice questions for a Singapore student.
        Subject: {subject}
        Specific Topics: {topics}
        """

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
        (Your detailed example output remains here...)
        """
        
        response_json_text = generate_ai_text(quiz_generation_prompt, quiz_system_instruction)
        # The AI should return valid JSON, so we can pass it directly.
        return response_json_text, 200, {'Content-Type': 'application/json'}

    except Exception as e:
        print(f"Error in /api/generate-quiz endpoint: {e}")
        return jsonify({"error": "Failed to generate quiz. The AI may have returned an invalid format."}), 500


if __name__ == "__main__":
    app.run(debug=True)