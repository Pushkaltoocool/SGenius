// --- Firebase & Backend Configuration ---
const { auth, db, storage } = window.firebase;
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
    orderBy
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
import {
    ref,
    uploadBytesResumable,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-storage.js";


// --- IMPORTANT: CONFIGURE THESE ---
const FLASK_BACKEND_URL = "https://your-backend-app.herokuapp.com"; // <-- PASTE YOUR DEPLOYED BACKEND URL HERE
const IMGBB_API_KEY = "8c3ac5bab399ca801e354b900052510d"; // <-- PASTE YOUR IMGBB API KEY HERE
// ------------------------------------


// --- Global State ---
let currentUser = null;
let currentUserProfile = null;
let currentImageFile = null;

// --- Timer State ---
let timerInterval = null;
let timeInSeconds = 1500;
let isTimerRunning = false;
let initialTime = 1500;

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
    // Landing page buttons
    document.getElementById('get-started-btn').addEventListener('click', showLogin);
    document.getElementById('cta-button').addEventListener('click', showLogin);

    // Auth form switching
    document.getElementById('switch-to-signup').addEventListener('click', (e) => toggleAuthForm(e, 'signup'));
    document.getElementById('switch-to-login').addEventListener('click', (e) => toggleAuthForm(e, 'login'));

    // Form submission
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    document.getElementById('personalization-form').addEventListener('submit', handlePersonalization);
    logoutBtnHeader.addEventListener('click', handleLogout);

    // Initial auth state check
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
    } else { // role === 'teacher'
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
            router(); // Initial route
        }
        // If profile is somehow null, logout to be safe
        else {
             handleLogout();
        }
    } else {
        currentUser = null;
        currentUserProfile = null;
        window.removeEventListener('hashchange', router);
        landingPageContainer.style.display = 'block';
        appContainer.style.display = 'none';
        window.location.hash = ''; // Clear hash on logout
    }
}

async function handleLogin(e) {
    e.preventDefault();
    errorMessage.style.display = 'none';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle the rest
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
            classrooms: []
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

    // We already have the role from signup, stored in currentUserProfile
    const role = currentUserProfile.role;
    let profileData = {};

    if (role === 'student') {
        profileData = {
            level: document.getElementById('student-level').value,
            subjects: document.getElementById('student-subjects').value.split(',').map(s => s.trim()).filter(Boolean),
        };
    } else { // teacher
        profileData = {
            school: document.getElementById('teacher-school').value,
            subjects: document.getElementById('teacher-subjects').value.split(',').map(s => s.trim()).filter(Boolean),
        };
    }
    
    profileData.setupComplete = true;

    try {
        await updateDoc(doc(db, "users", currentUser.uid), profileData);
        // Force re-fetch of profile and trigger standard auth flow
        await handleAuthStatusChange(currentUser);
    } catch(error) {
        console.error("Error saving personalization:", error);
        alert("Could not save your preferences. Please try again.");
    }
}


async function handleLogout() {
    await signOut(auth);
}

async function fetchUserProfile(uid) {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        currentUserProfile = { uid, ...docSnap.data() };
    } else {
        // This case might happen on first signup if firestore is slow
        // or if there's a serious data issue.
        console.warn("Could not fetch user profile for UID:", uid);
        currentUserProfile = null;
    }
}

// --- Routing ---
const routes = {
    '#dashboard': renderDashboard,
    '#classrooms': renderClassrooms,
    '#logbook': renderLogbook,
    '#profile': renderProfile,
};

async function router() {
    if (!currentUser) return;
    
    // Classroom detail route, e.g., #classrooms/CLASS_ID
    const hash = window.location.hash || '#dashboard';
    const [path, id] = hash.split('/');

    const renderFunction = routes[path];

    if (renderFunction) {
        mainContent.innerHTML = '<h2>Loading...</h2>';
        await renderFunction(id); // Pass ID to renderer
        updateActiveNavLink(path);
    } else {
        window.location.hash = '#dashboard';
    }
}

function updateActiveNavLink(activeHash) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === activeHash);
    });
}

// --- Page Rendering Functions ---

function renderDashboard() {
    mainContent.className = 'main-grid-two-col';
    mainContent.innerHTML = `
        <div class="widget focus-timer">
            <h2>Focus Timer</h2>
            <div id="timer-display" class="timer-display">25:00</div>
            <div class="timer-controls">
                <button id="start-stop-timer">Start</button>
                <button id="reset-timer">Reset</button>
            </div>
        </div>
        <div class="widget ai-assistant">
            <h2>AI Study Assistant</h2>
            <div class="chat-window" id="chat-window">
                <div class="chat-message ai">Hello, ${currentUserProfile.displayName}! I am SGenius, your AI Tutor for the Singapore curriculum. How can I help you today?</div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="ai-prompt-input" placeholder="Explain photosynthesis for PSLE...">
                <button id="attach-file-btn" title="Attach Image">📎</button>
                <button id="ask-ai-btn">Send</button>
            </div>
             <div id="image-preview-container">
                <div class="preview-wrapper">
                    <img id="image-preview" src="" alt="Image Preview"/>
                    <button id="remove-image-btn" title="Remove Image">✖</button>
                </div>
             </div>
        </div>`;
    updateTimerDisplay();
    initFocusTimerListeners();
    initDashboardListeners();
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
                `<p><strong>Level:</strong> ${profile.level}</p>
                 <p><strong>Subjects:</strong> ${profile.subjects.join(', ')}</p>` :
                `<p><strong>School:</strong> ${profile.school}</p>
                 <p><strong>Subjects Taught:</strong> ${profile.subjects.join(', ')}</p>`
            }
        </div>`;
}


// --- FEATURE: AI Chat ---

function initDashboardListeners() {
    document.getElementById('ask-ai-btn').addEventListener('click', handleAiPrompt);
    document.getElementById('ai-prompt-input').addEventListener('keypress', (e) => e.key === 'Enter' && handleAiPrompt());
    document.getElementById('attach-file-btn').addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = handleImageAttachment;
        fileInput.click();
    });
    document.getElementById('remove-image-btn').addEventListener('click', removeImageAttachment);
}

function handleImageAttachment(e) {
    const file = e.target.files[0];
    if (!file) return;

    currentImageFile = file;
    const reader = new FileReader();
    reader.onload = (event) => {
        document.getElementById('image-preview').src = event.target.result;
        document.getElementById('image-preview-container').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function removeImageAttachment() {
    currentImageFile = null;
    document.getElementById('image-preview').src = '';
    document.getElementById('image-preview-container').style.display = 'none';
}


function addMessageToChat(text, sender, imageUrl = null) {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', sender);
    
    const textNode = document.createElement('p');
    textNode.textContent = text;
    messageDiv.appendChild(textNode);

    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.classList.add('uploaded-image');
        messageDiv.appendChild(img);
    }
    
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function uploadImageToImgBB(imageFile) {
    if (!IMGBB_API_KEY || IMGBB_API_KEY === "YOUR_IMGBB_API_KEY") {
        alert("Image upload is not configured. Please add an ImgBB API key.");
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


async function handleAiPrompt() {
    const input = document.getElementById('ai-prompt-input');
    const prompt = input.value.trim();
    if (!prompt && !currentImageFile) return;

    if (FLASK_BACKEND_URL === "https://your-backend-app.herokuapp.com") {
        alert("Backend is not configured. Please set the FLASK_BACKEND_URL in script.js");
        return;
    }

    const previewSrc = document.getElementById('image-preview').src;
    addMessageToChat(prompt, 'user', currentImageFile ? previewSrc : null);
    input.value = '';
    
    const loadingMessage = document.createElement('div');
    loadingMessage.classList.add('chat-message', 'ai', 'loading');
    loadingMessage.textContent = 'SGenius is thinking...';
    document.getElementById('chat-window').appendChild(loadingMessage);

    let imageUrl = null;
    if (currentImageFile) {
        imageUrl = await uploadImageToImgBB(currentImageFile);
        if (!imageUrl) {
             loadingMessage.textContent = 'Error: Could not upload image.';
             removeImageAttachment();
             return;
        }
    }
     removeImageAttachment();
    
    try {
        const response = await fetch(`${FLASK_BACKEND_URL}/api/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: prompt, image_url: imageUrl })
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        loadingMessage.remove();
        addMessageToChat(data.response, 'ai');

    } catch (error) {
        console.error("Error fetching AI response:", error);
        loadingMessage.textContent = `Error: Could not connect to AI assistant. ${error.message}`;
    }
}


// --- FEATURE: Focus Timer ---

function initFocusTimerListeners() {
    const startStopBtn = document.getElementById('start-stop-timer');
    const resetBtn = document.getElementById('reset-timer');
    if (startStopBtn) startStopBtn.addEventListener('click', toggleTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetTimer);
}

function updateTimerDisplay() {
    const minutes = String(Math.floor(timeInSeconds / 60)).padStart(2, '0');
    const seconds = String(timeInSeconds % 60).padStart(2, '0');
    const timeString = `${minutes}:${seconds}`;

    const dashboardDisplay = document.getElementById('timer-display');
    if (dashboardDisplay) dashboardDisplay.textContent = timeString;
    document.getElementById('header-timer-text').textContent = timeString;
}

function toggleTimer() {
    isTimerRunning = !isTimerRunning;
    const button = document.getElementById('start-stop-timer');
    const persistentTimerDisplay = document.getElementById('persistent-timer-display');

    if (isTimerRunning) {
        if (button) button.textContent = 'Pause';
        persistentTimerDisplay.style.display = 'flex';
        timerInterval = setInterval(() => {
            timeInSeconds--;
            updateTimerDisplay();
            if (timeInSeconds <= 0) {
                clearInterval(timerInterval);
                isTimerRunning = false;
                if (button) button.textContent = 'Start';
                handleTimerCompletion();
            }
        }, 1000);
    } else {
        if (button) button.textContent = 'Start';
        clearInterval(timerInterval);
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timeInSeconds = initialTime;
    updateTimerDisplay();
    const button = document.getElementById('start-stop-timer');
    if (button) button.textContent = 'Start';
    document.getElementById('persistent-timer-display').style.display = 'none';
}

async function handleTimerCompletion() {
    const durationInSeconds = initialTime;
    alert("Time's up! Great focus session.");
    const reflection = prompt("What did you accomplish during this session?");

    if (currentUser && durationInSeconds > 0) {
        try {
            const logCollectionRef = collection(db, `users/${currentUser.uid}/logs`);
            await addDoc(logCollectionRef, {
                timestamp: serverTimestamp(),
                duration: durationInSeconds,
                reflection: reflection || "N/A"
            });
            alert("Session saved to your logbook!");
        } catch(error) {
            console.error("Error saving log:", error);
            alert("Could not save your session to the logbook.");
        }
    }
    resetTimer();
}


// --- FEATURE: Study Logbook ---

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
            const duration = `${Math.floor(log.duration / 60)}m ${log.duration % 60}s`;
            html += `
                <li class="list-item">
                    <strong>${log.reflection}</strong>
                    <div class="meta">${date} - <span>${duration}</span></div>
                </li>`;
        });
        html += '</ul>';
        logList.innerHTML = html;

    } catch (error) {
        console.error("Error fetching logs:", error);
        logList.innerHTML = '<p class="error-text">Could not load your study logs. Please try again later.</p>';
    }
}


// --- FEATURE: Classrooms ---

/**
 * Main renderer for the classrooms page.
 * Displays teacher view or student view based on user role.
 * If a classId is provided in the URL, renders the detail view.
 */
async function renderClassrooms(classId) {
    if (classId) {
        await renderClassroomDetail(classId);
    } else {
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
}

/**
 * Fetches and displays the list of classrooms for the current user.
 */
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

/**
 * Shows the modal for creating a new classroom.
 */
function showCreateClassModal() {
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
    document.getElementById('modal-backdrop').style.display = 'flex';
    document.getElementById('cancel-modal-btn').addEventListener('click', hideModal);
    document.getElementById('create-class-form').addEventListener('submit', handleCreateClass);
}

/**
 * Handles the logic for creating a new classroom document in Firestore.
 */
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


/**
 * Handles the logic for a student joining a classroom using a code.
 */
async function handleJoinClass(e) {
    e.preventDefault();
    const joinCodeInput = document.getElementById('join-code-input');
    const joinCode = joinCodeInput.value.trim();
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


/**
 * Renders the detail view for a specific classroom.
 */
async function renderClassroomDetail(classId) {
    mainContent.className = 'main-grid-one-col';
    try {
        const classRef = doc(db, 'classrooms', classId);
        const classSnap = await getDoc(classRef);

        if (!classSnap.exists()) {
            mainContent.innerHTML = '<h2>Classroom not found.</h2>';
            return;
        }

        const classroom = classSnap.data();
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
                
                <div id="classroom-materials">
                    <h3>Study Materials</h3>
                    <div id="materials-list">Loading materials...</div>
                     ${isTeacher ? `
                        <div class="upload-area">
                            <h4>Upload New Material</h4>
                            <input type="file" id="material-upload-input">
                            <button id="upload-material-btn" class="btn btn-secondary">Upload File</button>
                            <div id="upload-progress" style="display:none;"></div>
                        </div>` 
                    : ''}
                </div>
            </div>`;

        if (isTeacher) {
            document.getElementById('upload-material-btn').addEventListener('click', () => handleMaterialUpload(classId));
        }

        await fetchAndDisplayMaterials(classId);

    } catch (error) {
        console.error("Error rendering classroom detail:", error);
        mainContent.innerHTML = '<h2>Error loading classroom.</h2>';
    }
}

/**
 * Handles the upload of a file to Firebase Storage and links it in Firestore.
 */
function handleMaterialUpload(classId) {
    const fileInput = document.getElementById('material-upload-input');
    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a file to upload.");
        return;
    }

    const storageRef = ref(storage, `classrooms/${classId}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    const progressDiv = document.getElementById('upload-progress');
    const uploadBtn = document.getElementById('upload-material-btn');
    progressDiv.style.display = 'block';
    uploadBtn.disabled = true;

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressDiv.innerHTML = `Uploading: ${Math.round(progress)}%`;
        },
        (error) => {
            console.error("Upload failed:", error);
            alert("File upload failed. Please try again.");
            progressDiv.style.display = 'none';
            uploadBtn.disabled = false;
        },
        async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            await addDoc(collection(db, `classrooms/${classId}/materials`), {
                name: file.name,
                url: downloadURL,
                uploadedAt: serverTimestamp(),
                uploader: currentUserProfile.displayName
            });

            progressDiv.innerHTML = 'Upload complete!';
            uploadBtn.disabled = false;
            fileInput.value = '';
            setTimeout(() => { progressDiv.style.display = 'none'; }, 2000);

            // Refresh materials list
            fetchAndDisplayMaterials(classId);
        }
    );
}

/**
 * Fetches and displays the list of materials for a given classroom.
 */
async function fetchAndDisplayMaterials(classId) {
    const materialsListDiv = document.getElementById('materials-list');
    
    try {
        const q = query(collection(db, `classrooms/${classId}/materials`), orderBy('uploadedAt', 'desc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            materialsListDiv.innerHTML = '<p>No materials have been uploaded yet.</p>';
            return;
        }

        let html = '<ul class="item-list">';
        querySnapshot.forEach(doc => {
            const material = doc.data();
            html += `
                <li class="list-item material-item">
                    <a href="${material.url}" target="_blank" rel="noopener noreferrer">
                        <strong>${material.name}</strong>
                    </a>
                    <div class="meta">Uploaded by ${material.uploader} on ${material.uploadedAt.toDate().toLocaleDateString()}</div>
                </li>`;
        });
        html += '</ul>';
        materialsListDiv.innerHTML = html;
        
    } catch (error) {
        console.error("Error fetching materials:", error);
        materialsListDiv.innerHTML = '<p class="error-text">Could not load materials.</p>';
    }
}

function hideModal() {
    document.getElementById('modal-backdrop').style.display = 'none';
    document.getElementById('modal-content').innerHTML = '';
}