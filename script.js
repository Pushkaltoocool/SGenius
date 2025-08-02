// --- Firebase & Backend Configuration ---
const { auth, db } = window.firebase;
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    updateDoc,
    serverTimestamp,
    Timestamp,
    writeBatch,
    orderBy // Make sure orderBy is imported for the logbook query
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";


// --- START OF CORRECTION ---
// The backend is split into two services on Render.
// One handles plain-text responses (chat, hints), and the other handles JSON (quiz).
// These URLs correspond to the services you will create in the guide.
const PLAIN_TEXT_BACKEND_URL = "https://sgenius-chatbot.onrender.com"; // For chat, feedback, hints
const JSON_BACKEND_URL = "https://sgenius-ai-quiz-generator.onrender.com"; // For AI Quiz Generator
const IMGBB_API_KEY = "8c3ac5bab399ca801e354b900052510d"; // Your ImgBB API Key
// --- END OF CORRECTION ---


// --- Global State ---
let currentUser = null;
let currentUserProfile = null;
let currentQuizData = []; // Holds questions for the active quiz

// --- Timer State ---
let timerInterval = null;
let timeInSeconds = 0;
let isTimerRunning = false;

// --- DOM Element References ---
const landingPageContainer = document.getElementById('landing-page-container');
const appContainer = document.getElementById('app-container');
const loginPage = document.getElementById('login-page');
const mainAppPage = document.getElementById('main-app');
const mainContent = document.getElementById('main-content');
const errorMessage = document.getElementById('error-message');
const userDisplayNameHeader = document.querySelector('#user-display-name');
const logoutBtnHeader = document.querySelector('#logout-btn');

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('get-started-btn').addEventListener('click', showLogin);
    document.getElementById('cta-button').addEventListener('click', showLogin);
    document.getElementById('switch-to-signup').addEventListener('click', (e) => toggleAuthForm(e, 'signup'));
    document.getElementById('switch-to-login').addEventListener('click', (e) => toggleAuthForm(e, 'login'));
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    document.getElementById('personalization-form').addEventListener('submit', handlePersonalization);
    logoutBtnHeader.addEventListener('click', handleLogout);
    onAuthStateChanged(auth, handleAuthStatusChange);
});


// --- Navigation and UI Toggling ---

function showLogin(e) {
    if (e) e.preventDefault();
    landingPageContainer.style.display = 'none';
    appContainer.style.display = 'block';
    loginPage.style.display = 'flex';
    mainAppPage.style.display = 'none';
    document.getElementById('personalization-modal').style.display = 'none';
}

function toggleAuthForm(e, view) {
    e.preventDefault();
    const isLogin = view === 'login';
    document.getElementById('login-form').style.display = isLogin ? 'block' : 'none';
    document.getElementById('signup-form').style.display = isLogin ? 'none' : 'block';
    document.getElementById('login-switch-text').style.display = isLogin ? 'none' : 'block';
    document.getElementById('signup-switch-text').style.display = isLogin ? 'block' : 'none';
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
}

function showPersonalizationModal(role) {
    loginPage.style.display = 'none';
    const personalizationModal = document.getElementById('personalization-modal');
    personalizationModal.style.display = 'flex';

    const studentOptions = document.getElementById('student-options');
    const teacherOptions = document.getElementById('teacher-options');
    const studentInputs = studentOptions.querySelectorAll('input, select');
    const teacherInputs = teacherOptions.querySelectorAll('input, select');

    if (role === 'student') {
        studentOptions.style.display = 'block';
        teacherOptions.style.display = 'none';
        studentInputs.forEach(input => input.disabled = false);
        teacherInputs.forEach(input => input.disabled = true);
    } else {
        studentOptions.style.display = 'none';
        teacherOptions.style.display = 'block';
        studentInputs.forEach(input => input.disabled = true);
        teacherInputs.forEach(input => input.disabled = false);
    }
}

// --- Authentication & User Profile Logic ---

async function handleAuthStatusChange(user) {
    if (user) {
        currentUser = user;
        await fetchUserProfile(user.uid);

        if (currentUserProfile && !currentUserProfile.setupComplete) {
            showPersonalizationModal(currentUserProfile.role);
        } else if (currentUserProfile) {
            userDisplayNameHeader.textContent = currentUserProfile.displayName || currentUser.email;
            landingPageContainer.style.display = 'none';
            appContainer.style.display = 'block';
            loginPage.style.display = 'none';
            document.getElementById('personalization-modal').style.display = 'none';
            mainAppPage.style.display = 'flex';
            window.addEventListener('hashchange', router);
            router();
        } else {
             handleLogout();
        }
    } else {
        currentUser = null;
        currentUserProfile = null;
        window.removeEventListener('hashchange', router);
        landingPageContainer.style.display = 'block';
        appContainer.style.display = 'none';
        window.location.hash = '';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    errorMessage.style.display = 'none';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        errorMessage.textContent = "Invalid credentials or user not found.";
        errorMessage.style.display = 'block';
    }
}

async function handleSignup(e) {
    e.preventDefault();
    errorMessage.textContent = "";
    const displayName = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const role = document.querySelector('input[name="role"]:checked').value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName });

        const userProfile = {
            uid: user.uid,
            displayName,
            email,
            role,
            setupComplete: false,
            createdAt: serverTimestamp(),
            subjects: [],
            studyStreak: 0,
            lastQuizCompleted: null,
        };
        await setDoc(doc(db, "users", user.uid), userProfile);
        currentUserProfile = userProfile;
        currentUser = user;
        showPersonalizationModal(role);

    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
    }
}

async function handlePersonalization(e) {
    e.preventDefault();
    if (!currentUser) return;
    const role = currentUserProfile.role;
    let profileData = {};

    if (role === 'student') {
        profileData = {
            level: document.getElementById('student-level').value,
            subjects: document.getElementById('student-subjects').value.split(',').map(s => s.trim()).filter(Boolean),
        };
    } else {
        profileData = {
            school: document.getElementById('teacher-school').value,
            subjects: document.getElementById('teacher-subjects').value.split(',').map(s => s.trim()).filter(Boolean),
        };
    }
    profileData.setupComplete = true;

    try {
        await updateDoc(doc(db, "users", currentUser.uid), profileData);
        await handleAuthStatusChange(currentUser);
    } catch(error) {
        console.error("Error saving personalization:", error);
        alert("Could not save your preferences. Please try again.");
    }
}

async function handleLogout() {
    if (isTimerRunning) {
        if(confirm("You have a timer running. Are you sure you want to log out? The current session will not be saved.")) {
            resetStopwatch();
        } else {
            return;
        }
    }
    await signOut(auth);
}

async function fetchUserProfile(uid) {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        currentUserProfile = { uid, ...docSnap.data() };
    } else {
        console.warn("Could not fetch user profile for UID:", uid);
        currentUserProfile = null;
    }
}

// --- Router ---
const routes = {
    '#dashboard': renderDashboard,
    '#classrooms': renderClassrooms,
    '#quiz': renderQuizPage,
    '#review': renderReviewPage,
    '#logbook': renderLogbook,
    '#profile': renderProfile,
    '#leaderboard': renderLeaderboard,
};

async function router() {
    if (!currentUser) return;
    const hash = window.location.hash || '#dashboard';
    const pathParts = hash.substring(1).split('/');
    mainContent.innerHTML = '<div class="content-box"><h2>Loading...</h2></div>';

    if (pathParts[0] === 'classrooms' && pathParts.length === 4 && pathParts[2] === 'assignment' && pathParts[3]) {
        const classId = pathParts[1];
        const assignmentId = pathParts[3];
        await renderAssignmentDetail(assignmentId, classId);
        updateActiveNavLink('#classrooms');
        return;
    }
    
    if (pathParts[0] === 'classrooms' && pathParts.length === 2 && pathParts[1]) {
        const classId = pathParts[1];
        await renderClassroomDetail(classId);
        updateActiveNavLink('#classrooms');
        return;
    }

    const renderFunction = routes['#' + pathParts[0]] || routes['#dashboard'];
    await renderFunction();
    updateActiveNavLink('#' + pathParts[0]);
}

function updateActiveNavLink(activeHash) {
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (activeHash.startsWith('#classrooms') && href === '#classrooms') {
            link.classList.add('active');
        } else {
            link.classList.toggle('active', href === activeHash);
        }
    });
}

// --- Page Rendering Functions ---

async function renderDashboard() {
    mainContent.className = 'main-grid-two-col';
    
    await fetchUserProfile(currentUser.uid);
    const streak = currentUserProfile.studyStreak || 0;
    const subjectOptions = (currentUserProfile.subjects || []).map(s => `<option value="${s}">${s}</option>`).join('');

    mainContent.innerHTML = `
        <div>
            <div class="widget timer-widget">
                <h2>Focus Timer</h2>
                <div id="timer-display" class="timer-display">00:00:00</div>
                <div class="input-group">
                    <label for="subject-select">Studying Subject:</label>
                    <select id="subject-select" ${subjectOptions.length === 0 ? 'disabled' : ''}>
                        ${subjectOptions || '<option disabled selected>Please add subjects in profile</option>'}
                    </select>
                </div>
                <div class="timer-controls">
                    <button id="start-pause-timer" class="btn btn-success" ${subjectOptions.length === 0 ? 'disabled' : ''}>Start</button>
                    <button id="finish-timer" class="btn btn-secondary" disabled>Finish & Log</button>
                </div>
            </div>
            <div class="streak-widget">
                <div class="emoji">🔥</div>
                <h3>Study Streak</h3>
                <p>${streak} Day${streak === 1 ? '' : 's'}</p>
                <div class="meta">Complete a quiz every day to keep it going!</div>
            </div>
        </div>
        <div class="widget ai-assistant">
            <h2>AI Study Assistant</h2>
            <div class="chat-window" id="chat-window">
                <div class="chat-message ai">Hello, ${currentUserProfile.displayName}! Ask me anything about your subjects.</div>
            </div>
            <form class="chat-input-area" id="ai-chat-form">
                <input type="text" id="ai-prompt-input" placeholder="Ask SGenius a question..." required>
                <button type="submit" id="ask-ai-btn" class="btn">Ask</button>
            </form>
        </div>`;

    initFocusTimerListeners();
    initAiChatListeners();
}

async function renderProfile() {
    mainContent.className = 'main-grid-one-col';
    const profile = currentUserProfile;
    mainContent.innerHTML = `
        <div class="content-box">
            <h2>Profile & Settings</h2>
            <p><strong>Name:</strong> ${profile.displayName}</p>
            <p><strong>Email:</strong> ${profile.email}</p>
            <p><strong>Role:</strong> <span class="role-display ${profile.role}">${profile.role}</span></p>
            ${profile.role === 'student' ?
                `<p><strong>Level:</strong> ${profile.level || 'Not set'}</p>
                 <p><strong>Subjects:</strong> ${(profile.subjects || []).join(', ') || 'Not set'}</p>` :
                `<p><strong>School:</strong> ${profile.school || 'Not set'}</p>
                 <p><strong>Subjects Taught:</strong> ${(profile.subjects || []).join(', ') || 'Not set'}</p>`
            }
        </div>`;
}

// --- QUIZ FEATURE FUNCTIONS ---

function renderQuizPage() {
    mainContent.className = 'main-grid-one-col';
    const subjectOptions = (currentUserProfile.subjects || []).map(s => `<option value="${s}">${s}</option>`).join('');

    mainContent.innerHTML = `
        <div class="content-box quiz-setup-container">
            <h2>AI Quiz Generator</h2>
            <p>Select your subject and topic to generate a custom practice quiz.</p>
            <form id="quiz-form" class="quiz-form">
                <div class="input-group">
                    <label for="quiz-subject">Subject</label>
                    <select id="quiz-subject" required>
                        <option value="" disabled selected>-- Select a Subject --</option>
                        ${subjectOptions}
                        <option value="other">Other...</option>
                    </select>
                </div>
                <div class="input-group" id="other-subject-group" style="display:none;">
                    <label for="quiz-other-subject">Custom Subject</label>
                    <input type="text" id="quiz-other-subject" placeholder="e.g., World History">
                </div>
                <div class="input-group">
                    <label for="quiz-topics">Specific Topics (Optional)</label>
                    <input type="text" id="quiz-topics" placeholder="e.g., Photosynthesis, Cell Division">
                </div>
                <div class="input-group">
                    <label for="quiz-num-questions">Number of Questions</label>
                    <input type="number" id="quiz-num-questions" value="5" min="1" max="10" required>
                </div>
                <button type="submit" class="btn">Generate Quiz</button>
            </form>
        </div>
        <div id="quiz-display-area" class="content-box" style="display:none;"></div>
    `;

    document.getElementById('quiz-subject').addEventListener('change', (e) => {
        document.getElementById('other-subject-group').style.display = e.target.value === 'other' ? 'block' : 'none';
    });
    document.getElementById('quiz-form').addEventListener('submit', handleQuizGeneration);
}

async function handleQuizGeneration(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating... Please Wait';

    let subject = document.getElementById('quiz-subject').value;
    if (subject === 'other') {
        subject = document.getElementById('quiz-other-subject').value;
    }
    const topics = document.getElementById('quiz-topics').value;
    const num_questions = document.getElementById('quiz-num-questions').value;

    if (!subject) {
        alert("Please select or enter a subject.");
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generate Quiz';
        return;
    }
    
    try {
        const response = await fetch(`${JSON_BACKEND_URL}/api/generate-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, topics, num_questions: parseInt(num_questions) })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `Server responded with status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.questions) {
            throw new Error("Received an invalid response from the server.");
        }
        currentQuizData = data.questions;
        displayQuiz(currentQuizData);

    } catch (error) {
        console.error("Quiz Generation Error:", error);
        alert(`Error: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generate Quiz';
    }
}

function displayQuiz(questions) {
    document.querySelector('.quiz-setup-container').style.display = 'none';
    const displayArea = document.getElementById('quiz-display-area');
    displayArea.style.display = 'block';

    let quizHtml = '<form id="quiz-display-form"><div class="quiz-display-container">';
    questions.forEach((q, index) => {
        const optionsHtml = q.options.map((option, i) => `
            <li>
                <label>
                    <input type="radio" name="question-${index}" value="${i}" required>
                    <span>${option}</span>
                </label>
            </li>
        `).join('');

        quizHtml += `
            <div class="question-block" data-question-index="${index}">
                <p class="question-text">${q.question_text}</p>
                <ul class="options-list">${optionsHtml}</ul>
            </div>
        `;
    });
    quizHtml += `</div><button type="submit" id="submit-quiz-btn" class="btn">Submit Quiz</button></form>`;
    displayArea.innerHTML = quizHtml;

    document.getElementById('quiz-display-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleQuizSubmit();
    });
}

async function handleQuizSubmit() {
    const quizContainer = document.querySelector('.quiz-display-container');
    const questionBlocks = quizContainer.querySelectorAll('.question-block');
    let score = 0;

    questionBlocks.forEach(block => {
        const index = block.dataset.questionIndex;
        const correctAnswer = currentQuizData[index].correct_answer_index;
        const selectedRadio = block.querySelector('input[type="radio"]:checked');
        const userAnswer = parseInt(selectedRadio.value);
        const options = block.querySelectorAll('label');

        options.forEach(opt => opt.style.pointerEvents = 'none');

        if (userAnswer === correctAnswer) {
            score++;
            options[userAnswer].classList.add('correct-answer');
        } else {
            options[userAnswer].classList.add('incorrect-answer');
            options[correctAnswer].classList.add('correct-answer');
        }
        
        block.insertAdjacentHTML('beforeend', `
            <div class="explanation-box">
                <strong>Explanation:</strong>
                <p>${currentQuizData[index].explanation}</p>
            </div>
            <input type="checkbox" class="review-checkbox" title="Save for review">
        `);
    });

    const resultsSummary = `
        <div class="results-summary">
            <h3>Quiz Complete!</h3>
            <p>Your Score: ${score} / ${questionBlocks.length}</p>
        </div>
    `;
    quizContainer.insertAdjacentHTML('beforebegin', resultsSummary);
    document.getElementById('submit-quiz-btn').style.display = 'none';
    quizContainer.parentElement.insertAdjacentHTML('beforeend', '<button id="save-review-btn" class="btn">Save Selected for Review</button>');
    quizContainer.parentElement.classList.add('quiz-results');

    document.getElementById('save-review-btn').addEventListener('click', handleSaveReviewQuestions);
    
    await updateStudyStreak();
}

async function updateStudyStreak() {
    const userRef = doc(db, "users", currentUser.uid);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const lastCompletedTimestamp = currentUserProfile.lastQuizCompleted;
    const lastCompleted = lastCompletedTimestamp ? lastCompletedTimestamp.toDate().getTime() : 0;
    
    let currentStreak = currentUserProfile.studyStreak || 0;

    if (lastCompleted === today) return; // Already completed a quiz today, no change
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (lastCompleted === yesterday.getTime()) {
        currentStreak++; // Streak continues
    } else {
        currentStreak = 1; // Streak resets or starts
    }

    try {
        await updateDoc(userRef, {
            studyStreak: currentStreak,
            lastQuizCompleted: Timestamp.fromDate(new Date(today))
        });
        currentUserProfile.studyStreak = currentStreak;
    } catch (error) {
        console.error("Error updating study streak:", error);
    }
}

async function handleSaveReviewQuestions() {
    const reviewCheckboxes = document.querySelectorAll('.review-checkbox:checked');
    if (reviewCheckboxes.length === 0) {
        alert("Please select at least one question to save.");
        return;
    }

    const batch = writeBatch(db);
    reviewCheckboxes.forEach(box => {
        const questionBlock = box.closest('.question-block');
        const questionIndex = parseInt(questionBlock.dataset.questionIndex);
        const questionData = currentQuizData[questionIndex];

        const reviewRef = doc(collection(db, `users/${currentUser.uid}/reviewQuestions`));
        batch.set(reviewRef, questionData);
    });

    try {
        await batch.commit();
        alert(`${reviewCheckboxes.length} question(s) saved for review!`);
        reviewCheckboxes.forEach(box => {
            box.disabled = true;
            box.closest('.question-block').querySelector('.review-checkbox').title = "Saved!";
        });
        document.getElementById('save-review-btn').disabled = true;
    } catch (error) {
        console.error("Error saving review questions:", error);
        alert("Could not save questions. Please try again.");
    }
}

async function renderReviewPage() {
    mainContent.className = 'main-grid-one-col';
    mainContent.innerHTML = `
        <div class="content-box review-container">
            <h2>Review Questions</h2>
            <p>Here are the questions you've saved. Go through them to solidify your understanding!</p>
            <div id="review-list">Loading saved questions...</div>
        </div>
    `;

    const listDiv = document.getElementById('review-list');
    try {
        const q = query(collection(db, `users/${currentUser.uid}/reviewQuestions`));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listDiv.innerHTML = '<p>You haven\'t saved any questions for review yet.</p>';
            return;
        }

        let html = '';
        querySnapshot.forEach(doc => {
            const question = doc.data();
            const optionsHtml = question.options.map((option, i) => `
                <li style="list-style-type: none;">
                    <label class="options-list-label ${i === question.correct_answer_index ? 'correct-answer' : ''}">
                       <span>${option}</span>
                    </label>
                </li>
            `).join('');

            html += `
                <div class="review-question-card">
                    <p class="question-text">${question.question_text}</p>
                    <ul class="options-list">${optionsHtml}</ul>
                    <div class="explanation-box">
                        <strong>Explanation:</strong>
                        <p>${question.explanation}</p>
                    </div>
                </div>
            `;
        });
        listDiv.innerHTML = html;

    } catch (error) {
        console.error("Error fetching review questions:", error);
        listDiv.innerHTML = '<p class="error-text">Could not load your saved questions.</p>';
    }
}

// --- AI Chat Assistant ---
function initAiChatListeners() {
    const chatForm = document.getElementById('ai-chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', handleAiChatSubmit);
    }
}
async function handleAiChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('ai-prompt-input');
    const userMessage = input.value.trim();
    if (!userMessage) return;

    const chatWindow = document.getElementById('chat-window');
    addMessageToChat(userMessage, 'user');
    input.value = '';
    
    addMessageToChat('SGenius is thinking...', 'ai', 'loading');

    try {
        const response = await fetch(`${PLAIN_TEXT_BACKEND_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Server responded with status: ${response.status}`);
        }
        
        const aiMessage = data.response;
        chatWindow.querySelector('.loading')?.remove();
        addMessageToChat(aiMessage, 'ai');
    } catch (error) {
        console.error('AI Chat Error:', error);
        chatWindow.querySelector('.loading')?.remove();
        addMessageToChat(`Sorry, I encountered an error: ${error.message}`, 'ai');
    }
}
function addMessageToChat(text, ...types) {
    const chatWindow = document.getElementById('chat-window');
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', ...types);
    messageElement.textContent = text;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// --- Focus Timer ---
function initFocusTimerListeners() {
    const startBtn = document.getElementById('start-pause-timer');
    const finishBtn = document.getElementById('finish-timer');
    if (startBtn) startBtn.addEventListener('click', toggleStopwatch);
    if (finishBtn) finishBtn.addEventListener('click', finishAndLogSession);
}
function updateTimerDisplay() {
    const hours = String(Math.floor(timeInSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((timeInSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(timeInSeconds % 60).padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;
    const dashboardDisplay = document.getElementById('timer-display');
    if (dashboardDisplay) dashboardDisplay.textContent = timeString;
    document.getElementById('header-timer-text').textContent = timeString;
}
function toggleStopwatch() {
    const startPauseBtn = document.getElementById('start-pause-timer');
    const finishBtn = document.getElementById('finish-timer');
    const subjectSelect = document.getElementById('subject-select');
    const persistentTimerDisplay = document.getElementById('persistent-timer-display');

    isTimerRunning = !isTimerRunning;
    if (isTimerRunning) {
        if (!subjectSelect.value) {
            alert("Please select a subject to study!");
            isTimerRunning = false;
            return;
        }
        startPauseBtn.textContent = 'Pause';
        startPauseBtn.classList.remove('btn-success');
        startPauseBtn.classList.add('btn-secondary');
        finishBtn.disabled = false;
        subjectSelect.disabled = true;
        persistentTimerDisplay.style.display = 'flex';
        
        timerInterval = setInterval(() => {
            timeInSeconds++;
            updateTimerDisplay();
        }, 1000);
    } else {
        startPauseBtn.textContent = 'Resume';
        startPauseBtn.classList.add('btn-success');
        clearInterval(timerInterval);
    }
}
function resetStopwatch() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timeInSeconds = 0;
    updateTimerDisplay();

    const startPauseBtn = document.getElementById('start-pause-timer');
    const finishBtn = document.getElementById('finish-timer');
    const subjectSelect = document.getElementById('subject-select');
    const persistentTimerDisplay = document.getElementById('persistent-timer-display');

    if (startPauseBtn) {
       startPauseBtn.textContent = 'Start';
       startPauseBtn.classList.remove('btn-secondary');
       startPauseBtn.classList.add('btn-success');
    }
    if (finishBtn) finishBtn.disabled = true;
    if (subjectSelect) subjectSelect.disabled = false;
    if(persistentTimerDisplay) persistentTimerDisplay.style.display = 'none';
}
async function finishAndLogSession() {
    const durationInSeconds = timeInSeconds;
    const subject = document.getElementById('subject-select').value;
    
    clearInterval(timerInterval);
    isTimerRunning = false;

    if (currentUser && durationInSeconds > 0) {
        try {
            const logCollectionRef = collection(db, `users/${currentUser.uid}/logs`);
            await addDoc(logCollectionRef, {
                timestamp: serverTimestamp(),
                duration: durationInSeconds,
                subject: subject
            });
            alert(`Session of ${formatDuration(durationInSeconds)} for ${subject} saved to your logbook!`);
        } catch(error) {
            console.error("Error saving log:", error);
            alert("Could not save your session to the logbook.");
        }
    }
    resetStopwatch();
}

// --- Logbook & Leaderboard ---
async function renderLogbook() {
    mainContent.className = 'main-grid-one-col';
    mainContent.innerHTML = `
        <div class="content-box">
            <h2>Study Logbook</h2>
            <div id="logbook-entry-list">Loading logs...</div>
        </div>`;
    
    const logList = document.getElementById('logbook-entry-list');

    try {
        const logCollectionRef = collection(db, `users/${currentUser.uid}/logs`);
        const q = query(logCollectionRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            logList.innerHTML = '<p>No study sessions logged yet. Use the Focus Timer to start!</p>';
            return;
        }

        let html = '<ul class="item-list">';
        querySnapshot.forEach(doc => {
            const log = doc.data();
            const date = log.timestamp.toDate().toLocaleString();
            const duration = formatDuration(log.duration);
            html += `
                <li class="list-item">
                    <div>
                        <strong>${log.subject}</strong>
                        <div class="meta">${date}</div>
                    </div>
                    <div class="time">${duration}</div>
                </li>`;
        });
        html += '</ul>';
        logList.innerHTML = html;

    } catch (error) {
        console.error("Error fetching logs:", error);
        logList.innerHTML = '<p class="error-text">Could not load your study logs. Please try again later.</p>';
    }
}
async function renderLeaderboard() {
    mainContent.className = 'main-grid-one-col';
    mainContent.innerHTML = `
        <div class="content-box">
            <div class="content-header">
                <h2>Leaderboard</h2>
                <div class="leaderboard-tabs">
                    <button class="active" data-period="daily">Today</button>
                    <button data-period="weekly">This Week</button>
                    <button data-period="monthly">This Month</button>
                </div>
            </div>
            <div id="leaderboard-content">Loading ranks...</div>
        </div>`;

    document.querySelector('.leaderboard-tabs').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelectorAll('.leaderboard-tabs button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            displayLeaderboard(e.target.dataset.period);
        }
    });

    displayLeaderboard('daily');
}
async function fetchAllUserLogs() {
    const usersSnapshot = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
    const allLogs = [];
    for (const userDoc of usersSnapshot.docs) {
        const logsQuery = query(collection(db, `users/${userDoc.id}/logs`));
        const logsSnapshot = await getDocs(logsQuery);
        logsSnapshot.forEach(logDoc => {
            allLogs.push({
                userId: userDoc.id,
                displayName: userDoc.data().displayName,
                ...logDoc.data()
            });
        });
    }
    return allLogs;
}
async function displayLeaderboard(period) {
    const contentDiv = document.getElementById('leaderboard-content');
    contentDiv.innerHTML = 'Calculating ranks...';
    
    try {
        const allLogs = await fetchAllUserLogs();
        const now = new Date();
        let startDate;

        if (period === 'daily') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (period === 'weekly') {
            const firstDayOfWeek = now.getDate() - now.getDay();
            startDate = new Date(now.setDate(firstDayOfWeek));
            startDate.setHours(0, 0, 0, 0);
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        const periodLogs = allLogs.filter(log => log.timestamp && log.timestamp.toDate() >= startDate);

        const userTotals = periodLogs.reduce((acc, log) => {
            acc[log.userId] = acc[log.userId] || { total: 0, displayName: log.displayName };
            acc[log.userId].total += log.duration;
            return acc;
        }, {});

        const sortedUsers = Object.entries(userTotals)
            .map(([userId, data]) => ({ userId, total: data.total, displayName: data.displayName }))
            .sort((a, b) => b.total - a.total);

        if (sortedUsers.length === 0) {
            contentDiv.innerHTML = '<p>No study sessions logged for this period yet.</p>';
            return;
        }

        let html = '<ul class="item-list rank-list">';
        sortedUsers.forEach((user, index) => {
            html += `
                <li class="list-item">
                    <span class="rank">#${index + 1}</span>
                    <div class="user-info"><strong>${user.displayName}</strong></div>
                    <div class="time">${formatDuration(user.total)}</div>
                </li>`;
        });
        html += '</ul>';
        contentDiv.innerHTML = html;

    } catch(error) {
        console.error("Error displaying leaderboard:", error);
        contentDiv.innerHTML = '<p class="error-text">Could not load leaderboard data.</p>';
    }
}
function formatDuration(seconds) {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

// --- Classrooms & Assignments ---
async function renderClassrooms() {
    mainContent.className = 'main-grid-one-col';
    const isTeacher = currentUserProfile.role === 'teacher';
    
    mainContent.innerHTML = `
        <div class="content-box">
            <div class="content-header">
                <h2>Classrooms</h2>
                ${isTeacher
                    ? `<button id="create-class-btn" class="btn">Create New Classroom</button>`
                    : `<form id="join-class-form" class="join-form"><input type="text" id="join-code-input" placeholder="Enter Join Code" required><button type="submit">Join</button></form>`
                }
            </div>
            <div id="classroom-list">Loading classrooms...</div>
        </div>`;
    
    if (isTeacher) {
        document.getElementById('create-class-btn').addEventListener('click', showCreateClassModal);
    } else {
        document.getElementById('join-class-form').addEventListener('submit', handleJoinClass);
    }
    await fetchAndDisplayUserClassrooms();
}
async function fetchAndDisplayUserClassrooms() {
    const listContainer = document.getElementById('classroom-list');
    listContainer.innerHTML = '';
    const isTeacher = currentUserProfile.role === 'teacher';
    
    try {
        const q = isTeacher
            ? query(collection(db, "classrooms"), where("teacherId", "==", currentUser.uid))
            : query(collection(db, "classrooms"), where("studentIds", "array-contains", currentUser.uid));
            
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listContainer.innerHTML = `<p>No classrooms found. ${isTeacher ? "Create one to get started!" : "Join a class using a code from your teacher."}</p>`;
            return;
        }

        let html = '<ul class="item-list">';
        querySnapshot.forEach(doc => {
            const classroom = doc.data();
            html += `
                <a href="#classrooms/${doc.id}" class="list-item-link">
                    <li class="list-item">
                        <strong>${classroom.name}</strong>
                        <div class="meta">Subject: ${classroom.subject}</div>
                    </li>
                </a>`;
        });
        html += '</ul>';
        listContainer.innerHTML = html;
        
    } catch(error) {
        console.error("Error fetching classrooms:", error);
        listContainer.innerHTML = '<p class="error-text">Could not load classrooms.</p>';
    }
}
function showCreateClassModal() {
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <form id="create-class-form">
            <h2>Create New Classroom</h2>
            <div class="input-group">
                <label for="class-name">Classroom Name</label>
                <input type="text" id="class-name" required>
            </div>
            <div class="input-group">
                <label for="class-subject">Subject</label>
                <input type="text" id="class-subject" required>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" id="cancel-modal-btn">Cancel</button>
                <button type="submit" class="btn">Create</button>
            </div>
        </form>
    `;
    modalBackdrop.style.display = 'flex';
    document.getElementById('cancel-modal-btn').addEventListener('click', hideModal);
    document.getElementById('create-class-form').addEventListener('submit', handleCreateClass);
}
async function handleCreateClass(e) {
    e.preventDefault();
    const name = document.getElementById('class-name').value;
    const subject = document.getElementById('class-subject').value;
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
        const classroomRef = await addDoc(collection(db, "classrooms"), {
            name,
            subject,
            joinCode,
            teacherId: currentUser.uid,
            teacherName: currentUserProfile.displayName,
            createdAt: serverTimestamp(),
            studentIds: []
        });
        
        hideModal();
        alert(`Classroom created! Join code: ${joinCode}`);
        window.location.hash = `#classrooms/${classroomRef.id}`;
    } catch (error) {
        console.error("Error creating class:", error);
        alert("Could not create classroom. Please try again.");
    }
}
async function handleJoinClass(e) {
    e.preventDefault();
    const joinCodeInput = document.getElementById('join-code-input');
    const joinCode = joinCodeInput.value.trim().toUpperCase();
    if (!joinCode) return;

    try {
        const q = query(collection(db, "classrooms"), where("joinCode", "==", joinCode));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("Invalid join code. Please check and try again.");
            return;
        }

        const classroomDoc = querySnapshot.docs[0];
        const classroomData = classroomDoc.data();

        if (classroomData.studentIds.includes(currentUser.uid)) {
            alert("You are already enrolled in this classroom.");
            joinCodeInput.value = '';
            return;
        }

        const updatedStudentIds = [...classroomData.studentIds, currentUser.uid];
        await updateDoc(doc(db, "classrooms", classroomDoc.id), {
            studentIds: updatedStudentIds
        });

        alert(`Successfully joined "${classroomData.name}"!`);
        joinCodeInput.value = '';
        fetchAndDisplayUserClassrooms();

    } catch (error) {
        console.error("Error joining classroom:", error);
        alert("An error occurred while trying to join the classroom.");
    }
}
async function renderClassroomDetail(classId) {
    mainContent.className = 'main-grid-one-col';
    try {
        const classRef = doc(db, 'classrooms', classId);
        const classSnap = await getDoc(classRef);
        if (!classSnap.exists()) throw new Error("Classroom not found");
        const classroom = { id: classSnap.id, ...classSnap.data() };
        const isTeacher = classroom.teacherId === currentUser.uid;

        mainContent.innerHTML = `
            <div class="content-box">
                <div class="content-header">
                    <div>
                        <a href="#classrooms" class="back-link">← Back to Classrooms</a>
                        <h2>${classroom.name}</h2>
                        <p class="meta">Subject: ${classroom.subject} | Taught by: ${classroom.teacherName}</p>
                    </div>
                    ${isTeacher ? `<p class="join-code">Join Code: <span>${classroom.joinCode}</span></p>` : ''}
                </div>
                
                <div id="classroom-assignments">
                    <div class="content-header">
                        <h3>Assignments</h3>
                        ${isTeacher ? `<button id="create-assignment-btn" class="btn btn-secondary">Create New Assignment</button>` : ''}
                    </div>
                    <div id="assignments-list">Loading assignments...</div>
                </div>
            </div>`;

        if (isTeacher) {
            document.getElementById('create-assignment-btn').addEventListener('click', () => showCreateAssignmentModal(classroom));
        }
        await fetchAndDisplayAssignments(classroom);

    } catch (error) {
        console.error("Error rendering classroom detail:", error);
        mainContent.innerHTML = `<div class="content-box"><h2>Error loading classroom. <a href="#classrooms">Go back</a></h2></div>`;
    }
}
function showCreateAssignmentModal(classroom) {
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <form id="create-assignment-form">
            <h2>New Assignment for ${classroom.name}</h2>
            <div class="input-group">
                <label for="assignment-title">Title</label>
                <input type="text" id="assignment-title" required>
            </div>
            <div class="input-group">
                <label for="assignment-file">Worksheet Image</label>
                <input type="file" id="assignment-file" accept="image/*" required>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" id="cancel-modal-btn">Cancel</button>
                <button type="submit" class="btn">Create</button>
            </div>
        </form>
    `;
    modalBackdrop.style.display = 'flex';
    document.getElementById('cancel-modal-btn').addEventListener('click', hideModal);
    document.getElementById('create-assignment-form').addEventListener('submit', (e) => handleCreateAssignment(e, classroom));
}
async function handleCreateAssignment(e, classroom) {
    e.preventDefault();
    const title = document.getElementById('assignment-title').value;
    const file = document.getElementById('assignment-file').files[0];
    if (!title || !file) return;

    const createBtn = e.target.querySelector('button[type="submit"]');
    createBtn.disabled = true;
    createBtn.textContent = "Uploading...";

    try {
        const imageUrl = await uploadImageToImgBB(file);
        if (!imageUrl) {
            throw new Error("Image upload failed. Please check the API key or try again.");
        }

        await addDoc(collection(db, `classrooms/${classroom.id}/assignments`), {
            title,
            worksheetImageUrl: imageUrl,
            teacherId: currentUser.uid,
            createdAt: serverTimestamp(),
            subject: classroom.subject,
            classId: classroom.id
        });
        
        hideModal();
        alert(`Assignment "${title}" created!`);
        await fetchAndDisplayAssignments(classroom);

    } catch(error) {
        console.error("Error creating assignment:", error);
        alert(error.message);
        createBtn.disabled = false;
        createBtn.textContent = "Create";
    }
}
async function fetchAndDisplayAssignments(classroom) {
    const listDiv = document.getElementById('assignments-list');
    listDiv.innerHTML = "Loading...";
    try {
        const q = query(collection(db, `classrooms/${classroom.id}/assignments`), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listDiv.innerHTML = '<p>No assignments have been created yet.</p>';
            return;
        }

        let html = '<ul class="item-list">';
        querySnapshot.forEach(doc => {
            const assignment = doc.data();
            html += `
                <a href="#classrooms/${classroom.id}/assignment/${doc.id}" class="list-item-link">
                    <li class="list-item assignment-item">
                        <div>
                            <strong>${assignment.title}</strong>
                            <div class="meta">Created on: ${assignment.createdAt.toDate().toLocaleDateString()}</div>
                        </div>
                    </li>
                </a>`;
        });
        html += '</ul>';
        listDiv.innerHTML = html;
        
    } catch (error) {
        console.error("Error fetching assignments:", error);
        listDiv.innerHTML = '<p class="error-text">Could not load assignments.</p>';
    }
}
async function renderAssignmentDetail(assignmentId, classId) {
    mainContent.className = 'main-grid-one-col';
    try {
        const assignmentRef = doc(db, `classrooms/${classId}/assignments/${assignmentId}`);
        const assignmentSnap = await getDoc(assignmentRef);
        if (!assignmentSnap.exists()) throw new Error("Assignment not found");

        const assignment = { id: assignmentSnap.id, ...assignmentSnap.data() };
        const isTeacher = assignment.teacherId === currentUser.uid;

        if (isTeacher) {
            await renderAssignmentDetail_TeacherView(assignment);
        } else {
            await renderAssignmentDetail_StudentView(assignment);
        }
    } catch(error) {
        console.error("Error rendering assignment detail:", error);
        mainContent.innerHTML = `<div class="content-box"><h2>Error loading assignment. <a href="#classrooms/${classId}">Go back</a></h2></div>`;
    }
}
async function renderAssignmentDetail_StudentView(assignment) {
    const submissionRef = doc(db, `classrooms/${assignment.classId}/assignments/${assignment.id}/submissions`, currentUser.uid);
    const submissionSnap = await getDoc(submissionRef);
    if (!submissionSnap.exists()) {
        await setDoc(submissionRef, {
            studentId: currentUser.uid,
            studentName: currentUserProfile.displayName,
            status: 'viewed',
            viewedAt: serverTimestamp()
        }, { merge: true });
    }

    const submissionData = (await getDoc(submissionRef)).data();
    let submissionHTML = '';

    if (submissionData?.status === 'submitted' || submissionData?.status === 'graded') {
        submissionHTML = `
            <h4>Your Submission</h4>
            <img src="${submissionData.submissionImageUrl}" alt="Your submission" class="assignment-worksheet">
            ${submissionData.status === 'graded' ? `
                <h4>Grade & Feedback</h4>
                <p><strong>Grade:</strong> ${submissionData.grade}</p>
                <div class="feedback-box">
                    <strong>Teacher's AI-Powered Feedback:</strong>
                    <p>${submissionData.feedback || "No feedback provided."}</p>
                </div>
            ` : '<p>Your work has been submitted and is awaiting grading.</p>'}
        `;
    } else {
        submissionHTML = `
            <h4>Submit Your Answer</h4>
            <form id="submission-form">
                <div class="input-group">
                    <label for="submission-file">Upload your completed worksheet (image)</label>
                    <input type="file" id="submission-file" accept="image/*" required>
                </div>
                <button type="submit" class="btn">Submit Work</button>
            </form>
            <div class="hint-container">
                <button id="get-hint-btn" class="btn">Stuck? Ask SGenius for a Hint</button>
                <div id="hint-box" style="display:none;"></div>
            </div>
        `;
    }

    mainContent.innerHTML = `
        <div class="content-box">
            <a href="#classrooms/${assignment.classId}" class="back-link">← Back to Classroom</a>
            <h2>${assignment.title}</h2>
            <p class="meta">Subject: ${assignment.subject}</p>
            <hr>
            <h3>Worksheet</h3>
            <img src="${assignment.worksheetImageUrl}" alt="Worksheet" class="assignment-worksheet">
            
            <div class="submission-card">
                ${submissionHTML}
            </div>
        </div>
    `;

    if (document.getElementById('submission-form')) {
        document.getElementById('submission-form').addEventListener('submit', e => handleStudentSubmission(e, assignment));
    }
    if (document.getElementById('get-hint-btn')) {
        document.getElementById('get-hint-btn').addEventListener('click', () => handleGetHint(assignment));
    }
}
async function handleGetHint(assignment) {
    const hintBtn = document.getElementById('get-hint-btn');
    const hintBox = document.getElementById('hint-box');
    hintBtn.disabled = true;
    hintBtn.textContent = 'Getting a hint...';
    hintBox.style.display = 'block';
    hintBox.textContent = 'SGenius is thinking...';

    try {
        const response = await fetch(`${PLAIN_TEXT_BACKEND_URL}/api/hint`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: assignment.subject, title: assignment.title })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to get hint from server.');
        }

        hintBox.textContent = data.hint;

    } catch(error) {
        console.error("Error getting hint:", error);
        hintBox.textContent = `Sorry, couldn't get a hint right now. Error: ${error.message}`;
    } finally {
        hintBtn.disabled = false;
        hintBtn.textContent = 'Stuck? Ask SGenius for a Hint';
    }
}
async function handleStudentSubmission(e, assignment) {
    e.preventDefault();
    const file = document.getElementById('submission-file').files[0];
    if(!file) return;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading...";

    try {
        const imageUrl = await uploadImageToImgBB(file);
        if (!imageUrl) {
            throw new Error("Image upload failed. Please try again.");
        }

        const submissionRef = doc(db, `classrooms/${assignment.classId}/assignments/${assignment.id}/submissions`, currentUser.uid);
        await updateDoc(submissionRef, {
            submissionImageUrl: imageUrl,
            status: 'submitted',
            submittedAt: serverTimestamp()
        });
        
        alert("Your work has been submitted!");
        renderAssignmentDetail(assignment.id, assignment.classId);

    } catch (error) {
        console.error("Error submitting work:", error);
        alert(error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Work";
    }
}
async function renderAssignmentDetail_TeacherView(assignment) {
     mainContent.innerHTML = `
        <div class="content-box">
            <a href="#classrooms/${assignment.classId}" class="back-link">← Back to Classroom</a>
            <h2>${assignment.title}</h2>
            <p class="meta">Subject: ${assignment.subject}</p>
            <hr>
            <h3>Submissions Dashboard</h3>
            <div id="submissions-list">Loading student submissions...</div>
        </div>
    `;
    
    const classSnap = await getDoc(doc(db, 'classrooms', assignment.classId));
    const classData = classSnap.data();
    if (!classData || !classData.studentIds || classData.studentIds.length === 0) {
        document.getElementById('submissions-list').innerHTML = "<p>No students have joined this class yet.</p>";
        return;
    }
    const studentIds = classData.studentIds;

    const submissionsSnap = await getDocs(collection(db, `classrooms/${assignment.classId}/assignments/${assignment.id}/submissions`));
    const submissions = submissionsSnap.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data();
        return acc;
    }, {});
    
    const usersSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', studentIds)));
    const students = usersSnap.docs.map(d => d.data());

    let html = '<ul class="item-list">';
    students.forEach(student => {
        const submission = submissions[student.uid];
        let statusBadge = '<span class="status-badge status-not-viewed">Not Viewed</span>';
        let submissionContent = '';

        if(submission) {
            if (submission.status === 'viewed') statusBadge = '<span class="status-badge status-viewed">Viewed</span>';
            if (submission.status === 'submitted') {
                 statusBadge = '<span class="status-badge status-submitted">Submitted</span>';
                 submissionContent = `
                    <div class="submission-card">
                        <img src="${submission.submissionImageUrl}" class="submission-image">
                        <form class="grading-form" data-student-id="${student.uid}">
                            <input type="text" class="grading-input" placeholder="Enter Grade (e.g., 85/100)" required>
                            <button type="submit" class="btn btn-sm">Generate Feedback & Save</button>
                        </form>
                    </div>`;
            }
            if (submission.status === 'graded') {
                statusBadge = `<span class="status-badge status-graded">Graded: ${submission.grade}</span>`;
                submissionContent = `
                     <div class="submission-card">
                        <img src="${submission.submissionImageUrl}" class="submission-image">
                        <div class="feedback-box">
                            <strong>AI-Generated Feedback:</strong>
                            <p>${submission.feedback}</p>
                        </div>
                    </div>`;
            }
        }

        html += `
            <li class="list-item">
                <div style="width:100%">
                    <strong>${student.displayName}</strong>
                    <div class="meta">${statusBadge}</div>
                    ${submissionContent}
                </div>
            </li>
        `;
    });
    html += '</ul>';

    document.getElementById('submissions-list').innerHTML = html;
    document.querySelectorAll('.grading-form').forEach(form => {
        form.addEventListener('submit', e => handleGrading(e, assignment));
    });
}
async function handleGrading(e, assignment) {
    e.preventDefault();
    const form = e.target;
    const studentId = form.dataset.studentId;
    const grade = form.querySelector('.grading-input').value.trim();
    if (!grade) return;
    
    const gradeButton = form.querySelector('button');
    gradeButton.disabled = true;
    gradeButton.textContent = "Generating...";

    try {
        const feedbackResponse = await fetch(`${PLAIN_TEXT_BACKEND_URL}/api/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                subject: assignment.subject, 
                grade: grade,
                title: assignment.title
            })
        });
        
        const feedbackData = await feedbackResponse.json();
        if (!feedbackResponse.ok) {
            throw new Error(feedbackData.error || "AI feedback server error.");
        }
        
        const feedbackText = feedbackData.feedback;

        const submissionRef = doc(db, `classrooms/${assignment.classId}/assignments/${assignment.id}/submissions`, studentId);
        await updateDoc(submissionRef, {
            grade: grade,
            status: 'graded',
            feedback: feedbackText,
            gradedAt: serverTimestamp()
        });

        alert(`Grade saved and AI feedback sent to the student.`);
        renderAssignmentDetail(assignment.id, assignment.classId);

    } catch(error) {
        console.error("Error during grading:", error);
        alert(`An error occurred: ${error.message}`);
        gradeButton.disabled = false;
        gradeButton.textContent = "Generate Feedback & Save";
    }
}

// --- Utilities ---
async function uploadImageToImgBB(imageFile) {
    if (!IMGBB_API_KEY || IMGBB_API_KEY.includes("YOUR")) {
        alert("Image upload is not configured. Please add an ImgBB API key in script.js.");
        return null;
    }
    const formData = new FormData();
    formData.append('image', imageFile);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.success) {
            return result.data.url;
        } else {
            console.error('ImgBB Upload Error:', result);
            return null;
        }
    } catch (error) {
        console.error('Error uploading to ImgBB:', error);
        return null;
    }
}
function hideModal() {
    const modalBackdrop = document.getElementById('modal-backdrop');
    if (modalBackdrop) modalBackdrop.style.display = 'none';
    const modalContent = document.getElementById('modal-content');
    if (modalContent) modalContent.innerHTML = '';
}