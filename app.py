import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

# Configure CORS to allow requests from your Firebase hosting domain
# In production, you should restrict this to your actual domain
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route('/')
def index():
    return "SGenius AI Feedback Backend is running."

@app.route('/api/feedback', methods=['POST'])
def generate_feedback():
    """
    API endpoint to generate personalized feedback for a student's submission.
    Receives a subject and a grade.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON input"}), 400

    subject = data.get('subject', 'General').lower()
    grade_str = data.get('grade', 'N/A').lower()

    if not subject or not grade_str:
        return jsonify({"error": "Subject and grade fields are required"}), 400

    # --- AI Logic for Personalized Feedback ---
    # This simulates an AI analyzing the grade and subject to give feedback.
    
    feedback_text = ""

    # Try to extract a numeric score if possible
    numeric_grade = -1
    try:
        if '/' in grade_str:
            parts = grade_str.split('/')
            numeric_grade = (int(parts[0]) / int(parts[1])) * 100
        elif '%' in grade_str:
            numeric_grade = int(grade_str.replace('%', '').strip())
        else:
            # Handle qualitative grades
            if 'a' in grade_str or 'excellent' in grade_str: numeric_grade = 95
            elif 'b' in grade_str or 'good' in grade_str: numeric_grade = 85
            elif 'c' in grade_str or 'satisfactory' in grade_str: numeric_grade = 75
            elif 'd' in grade_str or 'pass' in grade_str: numeric_grade = 65
            else: numeric_grade = 50
    except (ValueError, ZeroDivisionError):
        numeric_grade = -1 # Could not parse grade

    # Generate feedback based on score
    if numeric_grade >= 90:
        feedback_text = f"Outstanding work on this {subject} assignment! Your understanding of the topic is excellent. Keep up the great momentum."
    elif numeric_grade >= 75:
        feedback_text = f"Good job on this {subject} task. You have a solid grasp of the core concepts. To improve further, perhaps review the section on [key topic] to solidify your knowledge."
    elif numeric_grade >= 60:
        feedback_text = f"This is a satisfactory result for the {subject} assignment. You understand the basics, but there are some areas for improvement. I recommend spending more time on practice questions to build confidence."
    elif numeric_grade >= 0:
        feedback_text = f"It looks like this {subject} topic was challenging. Don't be discouraged! Let's review the fundamentals together. I suggest starting with [foundational concept] and watching some tutorial videos on the subject."
    else:
        feedback_text = f"Thank you for your submission on {subject}. The grade was '{data.get('grade')}'. Please review the core materials and let me know if you have specific questions."

    return jsonify({"feedback": feedback_text})

if __name__ == '__main__':
    # Use Gunicorn's port if available, otherwise default to 8080
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)