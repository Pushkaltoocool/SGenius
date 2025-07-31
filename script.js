// --- Firebase & Backend Configuration ---
const { auth, db } = window.firebase; // Removed 'storage'
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
    orderBy,
    Timestamp
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
// Removed all imports from firebase/storage


// --- IMPORTANT: CONFIGURE THESE ---
const FLASK_BACKEND_URL = "https://your-backend-app.herokuapp.com"; // <-- PASTE YOUR DEPLOYED BACKEND URL HERE
const IMGBB_API_KEY = "8c3ac5bab399ca801e354b900052510d"; // <-- PASTE YOUR IMGBB API KEY HERE
// ------------------------------------


// --- Global State ---
let currentUser = null;
let currentUserProfile = null;

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
        } else {
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

// --- NEW, ROBUST ROUTER ---
const routes = {
    '#dashboard': renderDashboard,
    '#classrooms': renderClassrooms, // This will always render the list now
    '#logbook': renderLogbook,
    '#profile': renderProfile,
    '#leaderboard': renderLeaderboard,
};

async function router() {
    if (!currentUser) return;

    const hash = window.location.hash || '#dashboard';
    const pathParts = hash.substring(1).split('/'); // e.g., "#classrooms/123" -> ["classrooms", "123"]

    mainContent.innerHTML = '<h2>Loading...</h2>';

    // Route: #classrooms/CLASS_ID/assignment/ASSIGNMENT_ID
    if (pathParts[0] === 'classrooms' && pathParts.length === 4 && pathParts[2] === 'assignment' && pathParts[3]) {
        const classId = pathParts[1];
        const assignmentId = pathParts[3];
        await renderAssignmentDetail(assignmentId, classId);
        updateActiveNavLink('#classrooms');
        return;
    }
    
    // Route: #classrooms/CLASS_ID
    if (pathParts[0] === 'classrooms' && pathParts.length === 2 && pathParts[1]) {
        const classId = pathParts[1];
        await renderClassroomDetail(classId);
        updateActiveNavLink('#classrooms');
        return;
    }

    // Standard routes (e.g., #dashboard, #profile)
    const renderFunction = routes['#'+pathParts[0]] || routes['#dashboard'];
    if (renderFunction) {
        await renderFunction();
        updateActiveNavLink('#'+pathParts[0]);
    } else {
        // Fallback to dashboard if route is unknown
        window.location.hash = '#dashboard';
    }
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

function renderDashboard() {
    mainContent.className = 'main-grid-two-col';
    const subjectOptions = currentUserProfile.subjects.map(s => `<option value="${s}">${s}</option>`).join('');
    mainContent.innerHTML = `
        <div class="widget timer-widget">
            <h2>Focus Timer</h2>
            <div id="timer-display" class="timer-display">00:00:00</div>
            <div class="input-group">
                <label for="subject-select">Studying Subject:</label>
                <select id="subject-select" ${currentUserProfile.subjects.length === 0 ? 'disabled' : ''}>
                    ${subjectOptions || '<option disabled selected>Please add subjects in profile</option>'}
                </select>
            </div>
            <div class="timer-controls">
                <button id="start-pause-timer" class="btn btn-success" ${currentUserProfile.subjects.length === 0 ? 'disabled' : ''}>Start</button>
                <button id="finish-timer" class="btn btn-secondary" disabled>Finish & Log</button>
            </div>
        </div>
        <div class="widget ai-assistant">
            <h2>AI Study Assistant</h2>
            <p style="text-align: center; color: var(--secondary-text);">The AI Assistant is now integrated into classroom assignments. Get personalized feedback from your teacher after they grade your work!</p>
             <div class="chat-window" id="chat-window">
                <div class="chat-message ai">Hello, ${currentUserProfile.displayName}! Use the Focus Timer to track your study sessions or head to the Classrooms tab to work on assignments.</div>
            </div>
        </div>`;
    updateTimerDisplay();
    initFocusTimerListeners();
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
                 <p><strong>Subjects:</strong> ${profile.subjects.join(', ') || 'Not set'}</p>` :
                `<p><strong>School:</strong> ${profile.school || 'Not set'}</p>
                 <p><strong>Subjects Taught:</strong> ${profile.subjects.join(', ') || 'Not set'}</p>`
            }
            <p class="meta" style="margin-top: 20px;">To update your details, you will need to re-create your profile (feature coming soon).</p>
        </div>`;
}


// --- FEATURE: Focus Timer (Stopwatch) ---

function initFocusTimerListeners() {
    document.getElementById('start-pause-timer').addEventListener('click', toggleStopwatch);
    document.getElementById('finish-timer').addEventListener('click', finishAndLogSession);
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

// --- FEATURE: Leaderboard ---

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

    displayLeaderboard('daily'); // Initial display
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
        } else { // monthly
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


// --- Reusable Image Upload Function ---
async function uploadImageToImgBB(imageFile) {
    if (!IMGBB_API_KEY || IMGBB_API_KEY.includes("PASTE YOUR")) {
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


// --- FEATURE: Classrooms & Assignments ---

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
        mainContent.innerHTML = `<h2>Error loading classroom. <a href="#classrooms">Go back</a></h2>`;
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
        mainContent.innerHTML = `<h2>Error loading assignment. <a href="#classrooms/${classId}">Go back</a></h2>`;
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
                    <strong>AI Feedback:</strong>
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
        let statusBadge = '<span class="status-badge">Not Viewed</span>';
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
                            <button type="submit" class="btn btn-sm">Save Grade</button>
                        </form>
                    </div>`;
            }
            if (submission.status === 'graded') {
                statusBadge = `<span class="status-badge status-graded">Graded: ${submission.grade}</span>`;
                submissionContent = `
                     <div class="submission-card">
                        <img src="${submission.submissionImageUrl}" class="submission-image">
                        <div class="feedback-box"><strong>Feedback:</strong> ${submission.feedback}</div>
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
    const grade = form.querySelector('.grading-input').value;
    if (!grade) return;
    
    const gradeButton = form.querySelector('button');
    gradeButton.disabled = true;
    gradeButton.textContent = "Saving...";

    try {
        const feedbackResponse = await fetch(`${FLASK_BACKEND_URL}/api/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: assignment.subject, grade: grade })
        });
        if (!feedbackResponse.ok) throw new Error("AI feedback server error.");
        const feedbackData = await feedbackResponse.json();
        const feedbackText = feedbackData.feedback;

        const submissionRef = doc(db, `classrooms/${assignment.classId}/assignments/${assignment.id}/submissions`, studentId);
        await updateDoc(submissionRef, {
            grade: grade,
            status: 'graded',
            feedback: feedbackText,
            gradedAt: serverTimestamp()
        });

        alert(`Grade saved and feedback generated for student.`);
        renderAssignmentDetail(assignment.id, assignment.classId); // Refresh view

    } catch(error) {
        console.error("Error during grading:", error);
        alert("An error occurred. Could not save grade.");
        gradeButton.disabled = false;
        gradeButton.textContent = "Save Grade";
    }
}


function hideModal() {
    document.getElementById('modal-backdrop').style.display = 'none';
    if(document.getElementById('modal-content')) {
        document.getElementById('modal-content').innerHTML = '';
    }
}