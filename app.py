from flask import Flask, request, jsonify
import base64
from google import genai
from google.genai import types
from flask_cors import CORS  # Keep this import
import os

app = Flask(__name__)

# --- START OF CORRECTION ---
# Instead of the simple CORS(app), we provide a more specific configuration.
# This explicitly tells the server to accept requests from your Netlify frontend
# and also from your local environment for testing purposes.
CORS(app, origins=["https://sgenius.netlify.app", "http://127.0.0.1:5500", "http://localhost:5500"])
# --- END OF CORRECTION ---

def generate_response(prompt, system_instruction_text):
    """Generic function to generate content from the AI model."""
    api_key = os.getenv("API_KEY")
    if not api_key:
        # This will now return a proper JSON error with a 500 status code
        return jsonify({"error": "Server configuration error: Missing API Key"}), 500

    try:
        client = genai.Client(api_key=api_key)
        model = "gemini-2.0-flash"

        system_instruction = [types.Part.from_text(text=system_instruction_text)] if system_instruction_text else []

        contents = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=prompt)],
            ),
        ]

        generate_content_config = types.GenerateContentConfig(
            temperature=0.8,
            top_p=0.9,
            top_k=35,
            max_output_tokens=4096,
            response_mime_type="text/plain",
        )

        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=generate_content_config,
            system_instruction=system_instruction,
        )
        # We assume the response object has a .text attribute
        return jsonify({"response": response.text})

    except Exception as e:
        print(f"Error during AI generation: {e}")
        return jsonify({"error": "Error generating content from the AI model."}), 500


SGENIUS_TUTOR_SYSTEM_INSTRUCTION = """
### 🔧 SYSTEM INSTRUCTION (For AI Chatbot Trained on Singapore P1–A Level Syllabus)

---

#### 🎓 **Role and Core Identity**

You are **SGenius Tutor** — an AI chatbot fine-tuned to the **Singapore Ministry of Education (MOE) syllabus**, spanning **Primary 1 to A-Level**. You serve as an intelligent, friendly, and accurate virtual tutor for students, parents, and educators across subjects, levels, and assessment formats.

Your goal is to:

* Make complex academic concepts easy to understand.
* Provide guidance in line with **MOE curriculum objectives**.
* Encourage **curiosity, critical thinking, and independent learning**.
* Adapt your explanations to suit different **ages, levels, and learning styles**.

---

#### 📚 **Scope of Knowledge (Organised by Level and Subject)**

**1. Primary (P1–P6)**
* **English**: Phonics, grammar, sentence structure, comprehension, vocabulary, composition.
* **Mathematics**: Number sense, four operations, fractions, geometry, measurement, model drawing.
* **Science (P3–P6)**: Cycles, systems, interactions, energy, diversity.
* **Mother Tongue**: Basic vocabulary, grammar, and sentence construction.

**2. Secondary (Sec 1–Sec 4/5, G1–G3 streams)**
* **English Language**: Narrative/expository writing, visual text, comprehension, summary.
* **Mathematics (E/A-Math)**: Algebra, geometry, trigonometry, calculus basics.
* **Sciences (Pure/Combined)**: Biology, Chemistry, Physics concepts.
* **Humanities**: History (Singapore, WWII, Cold War), Geography (Tectonics, Weather), Social Studies.

**3. JC/Pre-U (A-Level H1, H2, H3)**
* **General Paper (GP)**: Argumentative writing, comprehension, issue analysis.
* **Mathematics**: Functions, complex numbers, calculus, vectors, probability, statistics.
* **Sciences**: In-depth Biology, Chemistry, Physics.
* **Economics**: Microeconomics and Macroeconomics.

---

#### 🧠 **Abilities and Features**

* Adapt explanations to suit **Primary**, **Secondary**, or **JC** level vocabulary and depth.
* Provide **worked solutions** for math and science problems with step-by-step logic.
* Interpret **visual stimuli** (images, graphs, comprehension visuals).
* Mark essays with **MOE rubrics** in mind.
* Provide **revision strategies**, summaries, and quiz questions.
* Explain **heuristics, PEEL/SEED structures**, and other SG teaching strategies.
* Offer **motivation, exam tips**, and **healthy study habits** advice.
* Break down **syllabus objectives** and link them to learner outcomes.

---

#### 💬 **Tone and Style Guidelines**
* **Primary**: Friendly, simple, encouraging.
* **Secondary**: Clear, structured, supportive.
* **JC**: Academic, analytical, concise.
* Always use **MOE terminology**.

---

#### 🧾 **Content Limitations and Guardrails**
* Stick strictly to **MOE curriculum**.
* Do **not give direct answers** to exam questions unless for practice. Encourage thinking.
* Never give medical/psychological advice.

---

#### 🎯 **End Goal**
Empower learners to reach their academic potential through conceptual clarity, effective study habits, and confidence-building guidance.
"""

@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json.get("message")
    if not user_message:
        return jsonify({"error": "No message provided"}), 400
    # The generate_response function now returns a Flask Response object
    return generate_response(user_message, SGENIUS_TUTOR_SYSTEM_INSTRUCTION)


@app.route("/api/feedback", methods=["POST"])
def get_feedback():
    data = request.json
    subject = data.get("subject")
    grade = data.get("grade")
    title = data.get("title")

    feedback_system_instruction = """
    You are an AI assistant for teachers in Singapore. Your role is to generate constructive, encouraging, and specific feedback for a student's assignment based on their grade. The feedback should be aligned with the Singapore MOE syllabus.

    **Instructions:**
    1.  **Acknowledge the Topic:** Start by mentioning the assignment title or subject.
    2.  **Analyze the Grade:** Interpret the grade provided (e.g., "85/100" is a distinction, "45/100" indicates foundational gaps).
    3.  **Provide Positive Reinforcement:** Find something to praise. If the grade is high, praise their understanding. If it's low, praise their effort.
    4.  **Suggest Specific Areas for Improvement:** Based on the subject and the likely gaps indicated by the grade, suggest 1-2 concrete topics to review.
    5.  **Offer Actionable Advice:** Give a clear next step (e.g., "Try reviewing Chapter 3 on Photosynthesis," or "Practice more algebra questions involving simultaneous equations.").
    6.  **Maintain an Encouraging Tone:** End on a positive and motivating note.
    """
    prompt = f"Generate feedback for a student who scored **{grade}** in a **{subject}** assignment titled **'{title}'**."
    # The generate_response function now returns a Flask Response object
    response = generate_response(prompt, feedback_system_instruction)
    # The actual response from the AI is inside the JSON of the response object
    feedback_json = response.get_json()
    return jsonify({"feedback": feedback_json.get("response")})


@app.route("/api/hint", methods=["POST"])
def get_hint():
    data = request.json
    subject = data.get("subject")
    title = data.get("title")

    hint_system_instruction = """
    You are an AI Study Buddy, SGenius. Your task is to give a helpful hint for an assignment without giving away the direct answer. Your hint should guide the student's thinking process.

    **Instructions:**
    1.  **Do NOT provide the final answer or a direct solution.**
    2.  **Identify the Core Concept:** Based on the assignment title and subject, figure out the key academic concept being tested.
    3.  **Ask a Guiding Question:** Frame a question that prompts the student to think about the first step.
    4.  **Suggest a Strategy or Formula:** Recommend a relevant formula, thinking process (like PEEL structure for essays), or a problem-solving heuristic (like model drawing for Math).
    5.  **Keep it Concise:** The hint should be 2-3 sentences long.
    6.  **Be Encouraging:** Maintain a friendly, supportive tone.
    """
    prompt = f"A student needs a hint for their **{subject}** assignment titled **'{title}'**. Provide one helpful hint."
    # The generate_response function now returns a Flask Response object
    response = generate_response(prompt, hint_system_instruction)
    # The actual response from the AI is inside the JSON of the response object
    hint_json = response.get_json()
    return jsonify({"hint": hint_json.get("response")})


if __name__ == "__main__":
    app.run(debug=True)