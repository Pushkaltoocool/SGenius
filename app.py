import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

# Configure CORS to allow requests from your Firebase hosting domain
# In production, you should restrict this to your actual domain
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route('/')
def index():
    return "SGenius AI Tutor Backend is running."

@app.route('/api/ask', methods=['POST'])
def ask_sgenius():
    """
    Main API endpoint for the AI tutor.
    Receives a question and an optional image URL.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON input"}), 400

    question = data.get('question', '').lower()
    image_url = data.get('image_url')

    if not question:
        return jsonify({"error": "Question field is required"}), 400

    # --- Simulated AI Logic based on Keywords ---
    # This is where you would integrate a real AI/LLM model
    
    response_text = ""

    if image_url:
        response_text += f"I see the image you sent from {image_url}. "

    if "psle" in question or "primary school" in question:
        if "photosynthesis" in question:
            response_text += "For PSLE Science, photosynthesis is the process where plants use sunlight, water, and carbon dioxide to create their own food (glucose) and release oxygen. It mainly happens in the chloroplasts within leaf cells."
        else:
            response_text += "For Primary School questions, it's important to use simple terms. Could you be more specific about the topic?"
    
    elif "o-level" in question or "sec 3" in question or "chemistry" in question:
        if "mitosis" in question and "meiosis" in question:
            response_text += "Great O-Level Biology question! The key difference is that Mitosis produces two identical daughter cells for growth and repair, keeping the chromosome number the same. Meiosis, however, produces four genetically different gametes (sex cells) with half the number of chromosomes, essential for sexual reproduction."
        elif "mole concept" in question:
             response_text += "For O-Level Chemistry, the Mole is a unit for amount of substance. One mole of any substance contains Avogadro's constant (6.02 x 10^23) of particles. The mass of one mole is its relative atomic or molecular mass in grams."
        else:
            response_text += "For Secondary School / O-Level, a strong foundation is key. Which subject are you asking about? Chemistry, Physics, Biology?"

    elif "a-level" in question or "jc" in question or "gp" in question:
        if "essay" in question and "technology" in question:
            response_text += "For an A-Level General Paper essay on technology, a balanced structure is crucial. Start with a clear thesis. Argue both the benefits (e.g., connectivity, medical advances) and drawbacks (e.g., social alienation, privacy concerns). Use specific, recent examples and conclude by synthesizing your points to reaffirm your stand."
        else:
            response_text += "A-Level topics require depth and critical thinking. Please specify the subject (e.g., GP, Economics, Physics) and topic for a detailed explanation."

    else:
        response_text += f"As a simulated AI for the Singapore curriculum, I need more context. Your question was: '{data.get('question')}' Please mention the education level (PSLE, O-Level, A-Level) or subject for a more accurate answer."

    return jsonify({"response": response_text})

if __name__ == '__main__':
    # Use Gunicorn's port if available, otherwise default to 8080
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)