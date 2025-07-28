// --- Simulated Database for Frontend Only ---
// This object replaces Firebase Firestore for local storage of app data.
// It's a simple in-memory store and will reset on page refresh.
let simulatedDb = {
    users: {}, // Stores user profiles and their nested logs
    classrooms: [],
    groups: [],
};

// Initialize with dummy data for testing purposes
const dummyUser1Uid = 'fake-student-uid-123';
const dummyUser2Uid = 'fake-teacher-uid-456';

simulatedDb.users[dummyUser1Uid] = {
    uid: dummyUser1Uid,
    displayName: 'Alice Student',
    email: 'student@example.com',
    role: 'student',
    school: 'Fake High School',
    level: 'secondary',
    subjects: 'Math, Science',
    totalStudyTime: 7200, // 2 hours in seconds
    logs: [
        { id: 'log1', timestamp: Date.now() - 3600000, duration: 1500, reflection: "Revised algebra and geometry." },
        { id: 'log2', timestamp: Date.now() - 7200000, duration: 900, reflection: "Read history textbook chapter 3." }
    ]
};

simulatedDb.users[dummyUser2Uid] = {
    uid: dummyUser2Uid,
    displayName: 'Mr. Bob Teacher',
    email: 'teacher@example.com',
    role: 'teacher',
    school: 'Fake College',
    level: 'jc',
    subjects: 'Physics, Chemistry',
    totalStudyTime: 1800, // 30 minutes in seconds
    logs: [
        { id: 'log3', timestamp: Date.now() - 10800000, duration: 600, reflection: "Prepared lesson plan for next week." }
    ]
};

simulatedDb.classrooms.push({
    id: 'classroom-math',
    name: 'Calculus I',
    teacher: 'Mr. Bob Teacher',
    teacherUid: dummyUser2Uid,
    createdAt: Date.now() - 86400000
});
simulatedDb.classrooms.push({
    id: 'classroom-history',
    name: 'World History Basics',
    teacher: 'Ms. Carol',
    teacherUid: 'fake-teacher-uid-789',
    createdAt: Date.now() - 172800000
});

simulatedDb.groups.push({
    id: 'group-study',
    name: 'Weekend Study Crew',
    members: [dummyUser1Uid, dummyUser2Uid], // Alice and Bob are members
    createdAt: Date.now() - 259200000
});
simulatedDb.groups.push({
    id: 'group-project',
    name: 'Biology Project Team',
    members: [], // Empty for now
    createdAt: Date.now() - 129600000
});

// --- Global State ---
let currentUser = null; // Represents the logged-in user (simulated Firebase User object)
let currentUserProfile = null; // Stores user profile data from simulatedDb.users

// --- DOM Element References ---
const loginPage = document.getElementById('login-page');
const mainAppPage = document.getElementById('main-app');
const mainContent = document.getElementById('main-content'); // Area to inject dynamic content
const errorMessage = document.getElementById('error-message');
const userDisplayNameHeader = document.querySelector('#main-app #user-display-name'); // Specific to main app header
const logoutBtnHeader = document.querySelector('#main-app #logout-btn'); // Specific to main app header

// --- Simulated Authentication Functions ---
// These functions mimic Firebase Auth API behavior
const simulateAuth = {
    // Simulates creating a new user. For a frontend-only demo, any non-empty credentials work.
    createUserWithEmailAndPassword: async (email, password) => {
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
        if (email.length < 3 || password.length < 6) {
            throw new Error("Weak password or invalid email format.");
        }
        const uid = 'fake-uid-' + Math.random().toString(36).substring(2, 12);
        const displayName = email.split('@');
        const user = { uid, email, displayName, getIdToken: async () => 'fake-jwt-token' }; // Fake getIdToken
        return { user };
    },
    // Simulates signing in a user. Uses predefined dummy accounts.
    signInWithEmailAndPassword: async (email, password) => {
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
        if (email === 'student@example.com' && password === 'password') {
            const user = { uid: dummyUser1Uid, email: 'student@example.com', displayName: 'Alice Student', getIdToken: async () => 'fake-jwt-token' };
            return { user };
        } else if (email === 'teacher@example.com' && password === 'password') {
            const user = { uid: dummyUser2Uid, email: 'teacher@example.com', displayName: 'Mr. Bob Teacher', getIdToken: async () => 'fake-jwt-token' };
            return { user };
        }
        throw new Error("Invalid email or password for fake login. Try student@example.com / password or teacher@example.com / password.");
    },
    // Simulates updating a user's profile display name
    updateProfile: async (user, updates) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (user) {
            user.displayName = updates.displayName || user.displayName;
            // Update in simulatedDb as well
            if (simulatedDb.users[user.uid]) {
                simulatedDb.users[user.uid].displayName = user.displayName;
            }
        }
    },
    // Simulates user logout
    signOut: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        // In a real app, this would clear session, here we just unset currentUser
    }
};

// --- Simulated Firestore Functions ---
// These functions mimic Firebase Firestore API behavior for in-memory data management.
const simulateFirestore = {
    collection: (path) => ({ path }), // Returns a simple object representing a collection reference
    doc: (collectionPath, docId) => ({ collectionPath, docId }), // Returns a simple object representing a document reference

    getDoc: async (docRef) => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
        let data = null;
        if (docRef.collectionPath === 'users') {
            data = simulatedDb.users[docRef.docId];
        } else if (docRef.collectionPath === 'classrooms') {
            data = simulatedDb.classrooms.find(c => c.id === docRef.docId);
        } else if (docRef.collectionPath === 'groups') {
            data = simulatedDb.groups.find(g => g.id === docRef.docId);
        }

        return {
            exists: () => !!data,
            data: () => data
        };
    },

    setDoc: async (docRef, data, options = {}) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (docRef.collectionPath === 'users') {
            if (!simulatedDb.users[docRef.docId] || options.merge) {
                simulatedDb.users[docRef.docId] = { ...simulatedDb.users[docRef.docId], ...data, uid: docRef.docId };
                if (!simulatedDb.users[docRef.docId].logs) {
                    simulatedDb.users[docRef.docId].logs = []; // Ensure logs array exists
                }
            } else {
                simulatedDb.users[docRef.docId] = { ...data, uid: docRef.docId, logs: [] }; // Overwrite, fresh logs
            }
        }
    },

    addDoc: async (collectionRef, data) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        const newId = 'fake-id-' + Math.random().toString(36).substring(2, 11);
        if (collectionRef.path === 'classrooms') {
            simulatedDb.classrooms.push({ id: newId, ...data });
        } else if (collectionRef.path === 'groups') {
            simulatedDb.groups.push({ id: newId, ...data });
        } else if (collectionRef.path.startsWith('users/') && collectionRef.path.endsWith('/logs')) {
            const uid = collectionRef.path.split('/');
            if (simulatedDb.users[uid]) {
                simulatedDb.users[uid].logs.push({ id: newId, ...data });
            }
        }
        return { id: newId };
    },

    getDocs: async (collectionRef) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        let docs = [];
        if (collectionRef.path === 'classrooms') {
            docs = simulatedDb.classrooms;
        } else if (collectionRef.path === 'groups') {
            docs = simulatedDb.groups;
        } else if (collectionRef.path === 'users') { // For leaderboard
            docs = Object.values(simulatedDb.users);
        } else if (collectionRef.path.startsWith('users/') && collectionRef.path.endsWith('/logs')) {
            const uid = collectionRef.path.split('/');
            docs = simulatedDb.users[uid] ? simulatedDb.users[uid].logs : [];
        }

        return {
            empty: docs.length === 0,
            forEach: (callback) => {
                docs.forEach(doc => callback({ id: doc.id, data: () => doc }));
            }
        };
    },

    updateDoc: async (docRef, data) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (docRef.collectionPath === 'users') {
            if (simulatedDb.users[docRef.docId]) {
                simulatedDb.users[docRef.docId] = { ...simulatedDb.users[docRef.docId], ...data };
            }
        } else if (docRef.collectionPath === 'groups') {
            const groupIndex = simulatedDb.groups.findIndex(g => g.id === docRef.docId);
            if (groupIndex !== -1) {
                simulatedDb.groups[groupIndex] = { ...simulatedDb.groups[groupIndex], ...data };
            }
        }
    },
    // These are typically field value transforms, for simplicity in this demo, they just return the value.
    // Array operations will be handled manually in the in-memory arrays.
    arrayUnion: (value) => value,
    arrayRemove: (value) => value
};


// This function mimics the onAuthStateChanged listener, but we call it explicitly.
async function handleAuthStatusChange(user) {
    if (user) {
        currentUser = user;
        // Ensure currentUser has a getIdToken method if it's checked by features
        currentUser.getIdToken = currentUser.getIdToken || (async () => 'fake-jwt-token');

        await fetchUserProfile(user.uid);

        if (userDisplayNameHeader) {
            userDisplayNameHeader.textContent = currentUser.displayName || currentUser.email;
        }

        loginPage.style.display = 'none';
        mainAppPage.style.display = 'flex';

        router(); // Render the current page based on hash
    } else {
        // User is signed out.
        currentUser = null;
        currentUserProfile = null;

        loginPage.style.display = 'flex';
        mainAppPage.style.display = 'none';

        // Optional: clear hash and redirect to base URL
        window.location.hash = '';
    }
}

// --- SPA (Single Page App) Router ---
const routes = {
    '#dashboard': renderDashboard,
    '#classrooms': renderClassrooms,
    '#groups': renderGroups,
    '#logbook': renderLogbook,
    '#profile': renderProfile,
};

async function router() {
    if (!currentUser) { // If not logged in, always show login page.
        handleAuthStatusChange(null);
        return;
    }
    const hash = window.location.hash || '#dashboard'; // Default to dashboard
    const render_function = routes[hash];

    if (render_function) {
        mainContent.innerHTML = 'Loading...'; // Show loading state
        await render_function(); // Call the function to render the page
        updateActiveNavLink(hash);
    } else {
        // If the hash is invalid, go to the dashboard
        window.location.hash = '#dashboard';
    }
}

function updateActiveNavLink(activeHash) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === activeHash);
    });
}

// Listen for hash changes to navigate between pages.
window.addEventListener('hashchange', router);

// Initial check for authentication status on page load (mimics initial Firebase check)
// For this demo, we assume no user is logged in initially, requiring a fake login.
handleAuthStatusChange(null);


// Helper function to get the user's profile data from simulatedDb.users.
async function fetchUserProfile(uid) {
    const docRef = simulateFirestore.doc('users', uid);
    const docSnap = await simulateFirestore.getDoc(docRef);
    if (docSnap.exists()) {
        currentUserProfile = { uid, ...docSnap.data() };
    } else {
        // If user document doesn't exist (e.g., new signup before profile save), create a basic one
        currentUserProfile = {
            uid,
            displayName: currentUser.displayName || currentUser.email,
            email: currentUser.email,
            role: "student",
            school: "",
            level: "",
            subjects: "",
            totalStudyTime: 0,
            logs: [] // Ensure logs array is initialized
        };
        await simulateFirestore.setDoc(docRef, currentUserProfile);
    }
}

// --- Auth Form Event Listeners ---
document.getElementById('switch-to-signup').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
    document.getElementById('login-switch-text').style.display = 'none';
    document.getElementById('signup-switch-text').style.display = 'block';
    errorMessage.style.display = 'none';
});

document.getElementById('switch-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-switch-text').style.display = 'block';
    document.getElementById('signup-switch-text').style.display = 'none';
    errorMessage.style.display = 'none';
});

document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.style.display = 'none';
    const displayName = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        const userCredential = await simulateAuth.createUserWithEmailAndPassword(email, password);
        await simulateAuth.updateProfile(userCredential.user, { displayName });
        // Create a corresponding user document in simulatedDb.users.
        // Also initialize totalStudyTime and logs array.
        await simulateFirestore.setDoc(simulateFirestore.doc("users", userCredential.user.uid), {
            displayName, email, role: "student", school: "", level: "", subjects: "", totalStudyTime: 0, logs: []
        });
        handleAuthStatusChange(userCredential.user); // Manually trigger state change
    } catch (error) {
        console.error("Signup failed:", error);
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.style.display = 'none';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const userCredential = await simulateAuth.signInWithEmailAndPassword(email, password);
        handleAuthStatusChange(userCredential.user); // Manually trigger state change
    } catch (error) {
        console.error("Login failed:", error);
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
    }
});

if (logoutBtnHeader) {
    logoutBtnHeader.addEventListener('click', async () => {
        try {
            await simulateAuth.signOut();
            handleAuthStatusChange(null); // Manually trigger state change to signed out
        } catch (error) {
            console.error('Logout failed:', error);
        }
    });
}


// --- PAGE RENDERING FUNCTIONS ---
// These functions dynamically create the HTML for each "page" and inject it into the <main> element.
// They also attach any necessary event listeners for that page's functionality.

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
            <h2>AI Study Assistant (Simulated)</h2>
            <div class="chat-window" id="chat-window">
                <!-- Messages will be added here by JS -->
                <div class="chat-message ai">Hello! How can I help you study today? (This is a simulated AI)</div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="ai-prompt-input" placeholder="Ask about H2 Math, GP essays, and more...">
                <button id="ask-ai-btn">Send</button>
            </div>
        </div>`;
    initFocusTimer(1500); // 25 minutes
    initDashboardListeners();
}

function renderProfile() {
    mainContent.className = 'main-grid-one-col';
    // Ensure currentUserProfile is loaded before rendering
    if (!currentUserProfile) {
        mainContent.innerHTML = `<div class="content-box">Loading profile...</div>`;
        return;
    }
    mainContent.innerHTML = `
        <div class="content-box">
            <h2>Profile & Settings</h2>
            <form id="profile-form">
                <div class="form-group">
                    <label for="profile-name">Display Name</label>
                    <input type="text" id="profile-name" value="${currentUser.displayName || currentUser.email}" required>
                </div>
                <div class="form-group">
                    <label for="profile-email">Email</label>
                    <input type="email" id="profile-email" value="${currentUser.email}" disabled>
                </div>
                <div class="form-group">
                    <label for="role">Role</label>
                    <select id="role">
                        <option value="student" ${currentUserProfile.role === 'student' ? 'selected' : ''}>Student</option>
                        <option value="teacher" ${currentUserProfile.role === 'teacher' ? 'selected' : ''}>Teacher</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="school">School</label>
                    <input type="text" id="school" placeholder="Enter your school" value="${currentUserProfile.school || ''}">
                </div>
                <div class="form-group">
                    <label for="level">Level</label>
                    <select id="level">
                        <option value="primary" ${currentUserProfile.level === 'primary' ? 'selected' : ''}>Primary</option>
                        <option value="secondary" ${currentUserProfile.level === 'secondary' ? 'selected' : ''}>Secondary</option>
                        <option value="jc" ${currentUserProfile.level === 'jc' ? 'selected' : ''}>JC</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="subjects">Subjects</label>
                    <input type="text" id="subjects" placeholder="e.g. H2 Math, GP" value="${currentUserProfile.subjects || ''}">
                </div>
                <button type="submit" class="btn btn-success">Save Profile</button>
            </form>
        </div>`;
    initProfileListeners();
}

async function renderClassrooms() {
    mainContent.className = 'main-grid-one-col';
    mainContent.innerHTML = `
        <div class="content-box">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <h2>Classrooms</h2>
                ${currentUserProfile && currentUserProfile.role === 'teacher' ? '<button id="create-classroom-btn" class="btn btn-primary">Create Classroom</button>' : ''}
            </div>
            <div id="classrooms-list" class="item-list">Loading...</div>
        </div>`;
    await loadClassrooms();
    initClassroomsListeners();
}

async function renderGroups() {
    mainContent.className = 'main-grid-one-col';
    mainContent.innerHTML = `
         <div class="content-box">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <h2>My Study Groups</h2>
                <button id="create-group-btn" class="btn btn-primary">Create New Group</button>
            </div>
            <div id="groups-list" class="item-list">Loading...</div>
            <h3>Leaderboard (Total Study Time)</h3>
            <ol id="leaderboard-list" class="leaderboard">Loading...</ol>
        </div>`;
    await loadGroups();
    await loadLeaderboard();
    initGroupsListeners();
}

async function renderLogbook() {
    mainContent.className = 'main-grid-one-col';
    mainContent.innerHTML = `
        <div class="content-box">
            <h2>Study Logbook</h2>
            <div id="logbook-entries" class="item-list">Loading...</div>
        </div>`;
    await loadLogs();
}

// --- FEATURE-SPECIFIC LOGIC & LISTENERS ---

// Dashboard & AI Chat (Simulated)
function initDashboardListeners() {
    const askAiBtn = document.getElementById('ask-ai-btn');
    const aiPromptInput = document.getElementById('ai-prompt-input');

    if (askAiBtn) askAiBtn.addEventListener('click', handleAiPrompt);
    if (aiPromptInput) aiPromptInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAiPrompt();
    });
}

function addMessageToChat(text, sender) {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return; // Guard
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', sender); // sender is 'user' or 'ai'
    messageDiv.textContent = text;
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight; // Auto-scroll to bottom
}

async function handleAiPrompt() {
    const aiPromptInput = document.getElementById('ai-prompt-input');
    const chatWindow = document.getElementById('chat-window');
    if (!aiPromptInput || !chatWindow) return; // Guard

    const prompt = aiPromptInput.value.trim();
    if (!prompt) return;

    addMessageToChat(prompt, 'user');
    aiPromptInput.value = ''; // Clear input

    // Add a loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.classList.add('chat-message', 'ai', 'loading');
    loadingIndicator.textContent = 'SGenius is thinking...';
    chatWindow.appendChild(loadingIndicator);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // Simulate AI response delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    chatWindow.removeChild(loadingIndicator); // Remove loading indicator

    let aiResponse = `I'm a simulated AI. I can only echo your input for now. You asked: "${prompt}"`;
    if (prompt.toLowerCase().includes("math") || prompt.toLowerCase().includes("calculus")) {
        aiResponse = "For math questions, try reviewing your formulas and practice similar problems from your textbook!";
    } else if (prompt.toLowerCase().includes("essay") || prompt.toLowerCase().includes("gp")) {
        aiResponse = "When writing essays, focus on a strong thesis, clear arguments, and supporting evidence. Structure is key!";
    } else if (prompt.toLowerCase().includes("study tips")) {
        aiResponse = "Try the Pomodoro Technique! Break your study into 25-minute intervals with short breaks. Also, active recall is super effective.";
    }

    addMessageToChat(aiResponse, 'ai');
}


// Focus Timer
let timerInterval = null;
let timeInSeconds = 0;
let isTimerRunning = false;
let initialTime = 0; // Stores the initial duration of the timer (e.g., 1500 for 25 mins)

function initFocusTimer(startTimeInSeconds) {
    timeInSeconds = startTimeInSeconds;
    initialTime = startTimeInSeconds;
    isTimerRunning = false;
    clearInterval(timerInterval);
    updateTimerDisplay();
    const startStopBtn = document.getElementById('start-stop-timer');
    const resetBtn = document.getElementById('reset-timer');
    if (startStopBtn) startStopBtn.textContent = 'Start'; // Ensure button text is "Start" on init
    // Ensure event listeners are only added once
    if (startStopBtn && !startStopBtn.dataset.listenerAdded) {
        startStopBtn.addEventListener('click', toggleTimer);
        startStopBtn.dataset.listenerAdded = 'true';
    }
    if (resetBtn && !resetBtn.dataset.listenerAdded) {
        resetBtn.addEventListener('click', resetTimer);
        resetBtn.dataset.listenerAdded = 'true';
    }
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timer-display');
    if (!timerDisplay) return; // Guard against element not being on the page
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function toggleTimer() {
    isTimerRunning = !isTimerRunning;
    const button = document.getElementById('start-stop-timer');
    if (!button) return; // Guard

    if (isTimerRunning) {
        button.textContent = 'Pause';
        timerInterval = setInterval(() => {
            timeInSeconds--;
            updateTimerDisplay();
            if (timeInSeconds <= 0) {
                clearInterval(timerInterval);
                isTimerRunning = false;
                button.textContent = 'Start';
                handleTimerCompletion();
            }
        }, 1000);
    } else {
        button.textContent = 'Start';
        clearInterval(timerInterval);
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timeInSeconds = initialTime; // Reset to the initial configured time
    const startStopBtn = document.getElementById('start-stop-timer');
    if (startStopBtn) startStopBtn.textContent = 'Start';
    updateTimerDisplay();
}

async function handleTimerCompletion() {
    const duration = initialTime - timeInSeconds; // Actual duration studied before timer hit 0
    alert("Time's up! Great focus session.");
    const reflection = prompt("What did you accomplish during this session?");

    if (currentUser && duration > 0) { // Only log if some time was spent
        // Add to user's logbook subcollection in simulatedDb
        const logCollectionRef = simulateFirestore.collection(`users/${currentUser.uid}/logs`);
        await simulateFirestore.addDoc(logCollectionRef, {
            timestamp: Date.now(), // Use milliseconds timestamp
            duration: duration,
            reflection: reflection || ""
        });

        // Update total study time for leaderboards in the user's main profile document
        const userDocRef = simulateFirestore.doc('users', currentUser.uid);
        const currentTotalTime = currentUserProfile.totalStudyTime || 0;
        const newTotalTime = currentTotalTime + duration;

        await simulateFirestore.updateDoc(userDocRef, { totalStudyTime: newTotalTime });
        currentUserProfile.totalStudyTime = newTotalTime; // Update local profile

        alert("Session saved to your logbook!");
    }
    resetTimer(); // Always reset the timer after completion
}


// Profile Logic
function initProfileListeners() {
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const displayNameInput = document.getElementById('profile-name');
            const roleInput = document.getElementById('role');
            const schoolInput = document.getElementById('school');
            const levelInput = document.getElementById('level');
            const subjectsInput = document.getElementById('subjects');

            const displayName = displayNameInput.value;
            const profileData = {
                displayName: displayName,
                role: roleInput.value,
                school: schoolInput.value,
                level: levelInput.value,
                subjects: subjectsInput.value,
            };

            try {
                // Update simulated Auth profile
                await simulateAuth.updateProfile(currentUser, { displayName });

                // Update simulated Firestore user document
                await simulateFirestore.setDoc(simulateFirestore.doc('users', currentUser.uid), profileData, { merge: true });

                // Update UI and local state
                if (userDisplayNameHeader) userDisplayNameHeader.textContent = displayName;
                await fetchUserProfile(currentUser.uid); // Re-fetch to ensure local profile is up-to-date
                alert('Profile saved!');
            } catch (error) {
                console.error("Failed to save profile:", error);
                alert(`Failed to save profile: ${error.message}`);
            }
        });
    }
}

// Classrooms Logic
function initClassroomsListeners() {
    const createClassroomBtn = document.getElementById('create-classroom-btn');
    if (createClassroomBtn) {
        createClassroomBtn.addEventListener('click', async () => {
            const name = prompt('Enter classroom name:');
            if (!name) return;
            if (!currentUser) {
                alert("You must be logged in to create a classroom.");
                return;
            }
            try {
                await simulateFirestore.addDoc(simulateFirestore.collection('classrooms'), {
                    name,
                    teacher: currentUser.displayName || currentUser.email,
                    teacherUid: currentUser.uid, // Store teacher's UID for permissions/filtering
                    createdAt: Date.now()
                });
                alert('Classroom created!');
                loadClassrooms(); // Reload list after creation
            } catch (error) {
                console.error("Error creating classroom:", error);
                alert(`Failed to create classroom: ${error.message}`);
            }
        });
    }
}

async function loadClassrooms() {
    const classroomsList = document.getElementById('classrooms-list');
    if (!classroomsList) return;
    classroomsList.innerHTML = 'Loading classrooms...';

    try {
        const snapshot = await simulateFirestore.getDocs(simulateFirestore.collection('classrooms'));
        let html = '';
        if (snapshot.empty) {
            html = '<p>No classrooms yet.</p>';
        } else {
            snapshot.forEach(doc => {
                const classroom = doc.data();
                html += `
                    <div class="list-item">
                        <strong>${classroom.name}</strong><br>
                        <span class="meta">Teacher: ${classroom.teacher || 'N/A'}</span>
                    </div>`;
            });
        }
        classroomsList.innerHTML = html;
    } catch (error) {
        console.error("Error loading classrooms:", error);
        classroomsList.innerHTML = `<p class="error-message">Failed to load classrooms: ${error.message}</p>`;
    }
}

// Groups Logic (with Leaderboard)
function initGroupsListeners() {
    const createGroupBtn = document.getElementById('create-group-btn');
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', async () => {
            const name = prompt('Enter group name:');
            if (!name) return;
            if (!currentUser) {
                alert("You must be logged in to create a group.");
                return;
            }
            try {
                await simulateFirestore.addDoc(simulateFirestore.collection('groups'), {
                    name,
                    members: [currentUser.uid], // Creator is the first member
                    createdAt: Date.now()
                });
                alert('Group created!');
                loadGroups(); // Reload list
            } catch (error) {
                console.error("Error creating group:", error);
                alert(`Failed to create group: ${error.message}`);
            }
        });
    }

    const groupsList = document.getElementById('groups-list');
    if (groupsList) {
        groupsList.addEventListener('click', async (e) => {
            if (e.target.classList.contains('join-leave-group-btn')) {
                const groupId = e.target.dataset.groupId;
                const isMember = e.target.dataset.isMember === 'true'; // Convert string to boolean
                const groupRef = simulateFirestore.doc('groups', groupId);

                try {
                    const groupDoc = await simulateFirestore.getDoc(groupRef);
                    if (groupDoc.exists()) {
                        const groupData = groupDoc.data();
                        let updatedMembers = groupData.members ? [...groupData.members] : []; // Create a copy

                        if (isMember) {
                            // Leave group
                            updatedMembers = updatedMembers.filter(uid => uid !== currentUser.uid);
                            alert('You have left the group.');
                        } else {
                            // Join group
                            updatedMembers.push(currentUser.uid);
                            alert('You have joined the group!');
                        }

                        // Manually update the simulatedDb for array modifications
                        // (simulateFirestore.updateDoc itself only overwrites, so we need to do the array logic here)
                        const targetGroup = simulatedDb.groups.find(g => g.id === groupId);
                        if (targetGroup) {
                            targetGroup.members = updatedMembers;
                        }

                        // Call simulated updateDoc (which will use the updated in-memory object)
                        await simulateFirestore.updateDoc(groupRef, { members: updatedMembers });

                        loadGroups(); // Reload list
                    }
                } catch (error) {
                    console.error("Error joining/leaving group:", error);
                    alert(`Failed to update group membership: ${error.message}`);
                }
            }
        });
    }
}

async function loadGroups() {
    const groupsList = document.getElementById('groups-list');
    if (!groupsList) return;
    groupsList.innerHTML = 'Loading groups...';
    try {
        const snapshot = await simulateFirestore.getDocs(simulateFirestore.collection('groups'));
        let html = '';
        if (snapshot.empty) {
            html = '<p>No groups yet. Create one!</p>';
        } else {
            snapshot.forEach(doc => {
                const group = doc.data();
                const isMember = group.members && group.members.includes(currentUser.uid);
                const buttonText = isMember ? 'Leave Group' : 'Join Group';
                const buttonClass = isMember ? 'btn-secondary' : 'btn-primary';
                html += `
                    <div class="list-item">
                        <strong>${group.name}</strong><br>
                        <span class="meta">Members: ${group.members ? group.members.length : 0}</span>
                        <button class="btn ${buttonClass} btn-sm float-end join-leave-group-btn" data-group-id="${group.id}" data-is-member="${isMember}">${buttonText}</button>
                    </div>`;
            });
        }
        groupsList.innerHTML = html;
    } catch (error) {
        console.error("Error loading groups:", error);
        groupsList.innerHTML = `<p class="error-message">Failed to load groups: ${error.message}</p>`;
    }
}

async function loadLeaderboard() {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;
    leaderboardList.innerHTML = 'Loading leaderboard...';

    try {
        // Get all users from simulatedDb and sort by totalStudyTime
        const usersRef = simulateFirestore.collection('users');
        const snapshot = await simulateFirestore.getDocs(usersRef);

        let usersData = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            usersData.push({
                displayName: data.displayName || 'Unknown User',
                totalStudyTime: data.totalStudyTime || 0 // Store in seconds
            });
        });

        // Sort by totalStudyTime in descending order
        usersData.sort((a, b) => b.totalStudyTime - a.totalStudyTime);

        let html = '';
        if (usersData.length === 0) {
            html = '<li>No users with study data yet.</li>';
        } else {
            usersData.forEach((user, index) => {
                const totalMinutes = Math.floor(user.totalStudyTime / 60);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                html += `
                    <li>
                        <span class="leaderboard-name">${index + 1}. ${user.displayName}</span>
                        <span class="leaderboard-time">${hours}h ${minutes}m</span>
                    </li>`;
            });
        }
        leaderboardList.innerHTML = html;

    } catch (error) {
        console.error("Error loading leaderboard:", error);
        leaderboardList.innerHTML = `<li class="error-message">Failed to load leaderboard: ${error.message}</li>`;
    }
}


// Logbook Logic
async function loadLogs() {
    const logbookEntries = document.getElementById('logbook-entries');
    if (!logbookEntries) return;
    logbookEntries.innerHTML = 'Loading study logs...';

    if (!currentUser) {
        logbookEntries.innerHTML = '<p>Please log in to view your study logs.</p>';
        return;
    }

    try {
        // Referencing the 'logs' subcollection under the current user's document in simulatedDb
        const logsRef = simulateFirestore.collection(`users/${currentUser.uid}/logs`);
        const snapshot = await simulateFirestore.getDocs(logsRef);
        let html = '';
        if (snapshot.empty) {
            html = '<p>No study logs yet. Complete a focus session to add one!</p>';
        } else {
            // Sort logs by timestamp (most recent first)
            let logs = [];
            snapshot.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
            logs.sort((a, b) => b.timestamp - a.timestamp); // Sort descending

            logs.forEach(log => {
                const date = new Date(log.timestamp).toLocaleString();
                const durationMinutes = Math.floor(log.duration / 60);
                html += `
                    <div class="list-item">
                        <strong>${date}</strong><br>
                        <span class="meta">Duration: ${durationMinutes} min</span><br>
                        <p>Reflection: ${log.reflection || 'No reflection provided.'}</p>
                    </div>`;
            });
        }
        logbookEntries.innerHTML = html;
    } catch (error) {
        console.error("Error loading study logs:", error);
        logbookEntries.innerHTML = `<p class="error-message">Failed to load logs: ${error.message}</p>`;
    }
}
