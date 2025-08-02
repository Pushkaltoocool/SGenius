from flask import Flask, request, jsonify
from google import genai
from google.genai import types
from flask_cors import CORS
import os
import json

app = Flask(__name__)

# This configuration is correct for allowing your Netlify app to connect.
CORS(app, origins=["https://sgenius.netlify.app", "http://127.0.0.1:5500", "http://localhost:5500"])


def generate_ai_text(prompt, system_instruction_text):
    """Generates text using the AI model and returns the raw text."""
    api_key = os.getenv("API_KEY")
    if not api_key:
        raise ValueError("API_KEY environment variable not set on the server.")

    client = genai.Client(api_key=api_key)
    model = "gemini-2.0-flash"

    system_instruction = [types.Part.from_text(text=system_instruction_text)] if system_instruction_text else []
    contents = [types.Content(role="user", parts=[types.Part.from_text(text=prompt)])]
    
    generate_content_config = types.GenerateContentConfig(
        temperature=0.7, # Slightly lower temperature for more predictable JSON
        response_mime_type="application/json", # We explicitly ask for JSON
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
(Your detailed system instruction remains here...)
"""

@app.route("/chat", methods=["POST"])
def chat():
    try:
        user_message = request.json.get("message")
        if not user_message:
            return jsonify({"error": "No message provided"}), 400
        
        response_text = generate_ai_text(user_message, SGENIUS_TUTOR_SYSTEM_INSTRUCTION)
        return jsonify({"response": json.loads(response_text)})

    except Exception as e:
        print(f"Error in /chat endpoint: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500

# --- NEW QUIZ GENERATOR ENDPOINT ---
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

        **EXAMPLE OUTPUT FORMAT:**
        {
          "questions": [
            {
              "question_text": "What is the primary function of mitochondria in a cell?",
              "options": [
                "To store genetic information",
                "To produce energy through cellular respiration",
                "To synthesize proteins",
                "To control cell movement"
              ],
              "correct_answer_index": 1,
              "explanation": "Mitochondria are known as the 'powerhouses' of the cell because they generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy."
            }
          ]
        }
        """
        
        response_json_text = generate_ai_text(quiz_generation_prompt, quiz_system_instruction)
        # The AI should return valid JSON, so we can pass it directly.
        return response_json_text, 200, {'Content-Type': 'application/json'}

    except Exception as e:
        print(f"Error in /api/generate-quiz endpoint: {e}")
        return jsonify({"error": "Failed to generate quiz. The AI may have returned an invalid format."}), 500


if __name__ == "__main__":
    # Your other endpoints for feedback, hints, etc., would also be here.
    # For brevity, I'm omitting them, but they should remain in your file.
    app.run(debug=True)