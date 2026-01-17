import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, doc, addDoc, query, where, orderBy, onSnapshot, getDoc, serverTimestamp, deleteDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBiCzv28fmnVFfiWWkQesWYs5IbrBQYApI",
    authDomain: "pietians.firebaseapp.com",
    projectId: "pietians",
    storageBucket: "pietians.firebasestorage.app",
    messagingSenderId: "483831102320",
    appId: "1:483831102320:web:b94d14a26a93ed81592db5",
    measurementId: "G-DZGX3XVLML"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let generatedOTP, currentUserEmail, chatWithEmail, unsubscribeChat;
let otpExpiryTime = null; 

// --- 1. SESSION CHECK & LIVE LISTENER ---
window.onload = async function() {
    const savedEmail = localStorage.getItem("verifiedEmail");
    if (savedEmail) {
        currentUserEmail = savedEmail;
        const userDoc = await getDoc(doc(db, "users", currentUserEmail));
        document.getElementById('login-section').style.display = 'none';
        if (userDoc.exists()) {
            const userData = userDoc.data();
            setupUserDashboard(userData);
            searchUsers();
            listenForNewMessages();
        } else {
            document.getElementById('info-section').style.display = 'block';
        }
    }
}

// --- 2. LIVE NOTIFICATION LOGIC ---
function listenForNewMessages() {
    const sessionStartTime = Date.now() - 5000; 
    const q = query(collection(db, "messages"), where("receiver", "==", currentUserEmail));

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const msg = change.data();
                let msgTime = msg.timestamp?.toMillis ? msg.timestamp.toMillis() : Date.now();

                if (msgTime > sessionStartTime) {
                    const dot = document.getElementById('nav-notify-dot');
                    if(dot) dot.style.display = 'block';

                    if (document.getElementById('chat-box').style.display === 'none' || chatWithEmail !== msg.sender) {
                        const senderDoc = await getDoc(doc(db, "users", msg.sender));
                        const senderName = senderDoc.exists() ? senderDoc.data().name : "New Message";
                        showInAppNotification(senderName, msg.text, msg.sender);
                    }
                }
            }
        });
    });
}

function showInAppNotification(senderName, text, senderEmail) {
    if (Notification.permission === "granted") new Notification(`💬 ${senderName}`, { body: text });
    const oldToast = document.querySelector('.whatsapp-toast');
    if(oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = 'whatsapp-toast';
    toast.style.cssText = `position: fixed; top: 25px; left: 50%; transform: translateX(-50%); background: white; padding: 12px 20px; border-radius: 25px; box-shadow: 0 15px 50px rgba(0,0,0,0.25); z-index: 2147483647; display: flex; align-items: center; gap: 15px; width: 320px; border-left: 6px solid #25D366; animation: slideDown 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards; cursor: pointer;`;

    toast.innerHTML = `<div style="font-size: 24px; background: #f0f2f5; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">👤</div>
        <div style="flex: 1; overflow: hidden;"><div style="font-weight: 800; font-size: 0.9em; color: #111;">${senderName}</div><div style="font-size: 0.82em; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${text}</div></div>
        <div style="color: #25D366; font-size: 12px;">●</div>`;

    toast.onclick = () => { openChat(senderEmail, senderName); toast.remove(); };
    document.body.appendChild(toast);
    setTimeout(() => { if(document.body.contains(toast)) toast.remove(); }, 4500);
}

// --- 3. FIXED TIMER LOGIC ---
function startOTPTimer(seconds) {
    const allElements = document.querySelectorAll('a, button, span');
    let resendBtn = null;
    allElements.forEach(el => {
        if(el.innerText.toLowerCase().includes('resend') || el.innerText.toLowerCase().includes('wait')) {
            resendBtn = el;
        }
    });

    const timerDisplay = document.querySelector('.code-expiry-timer') || document.getElementById('otp-timer-display');

    if (resendBtn) {
        resendBtn.style.pointerEvents = 'none'; 
        resendBtn.style.opacity = '0.5';
    }

    let timeLeft = seconds;
    if (window.otpInterval) clearInterval(window.otpInterval);

    window.otpInterval = setInterval(() => {
        timeLeft--;
        if (timerDisplay) timerDisplay.innerHTML = `⏳ Code expires in: ${timeLeft}s`;
        if (resendBtn) resendBtn.innerText = `Wait ${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(window.otpInterval);
            if (timerDisplay) timerDisplay.innerHTML = "❌ OTP Expired!";
            if (resendBtn) {
                resendBtn.innerText = "Resend";
                resendBtn.style.pointerEvents = 'auto'; 
                resendBtn.style.opacity = '1';
            }
        }
    }, 1000);
}

// --- 4. LOGIN & SIGNUP ---
window.handleLogin = async function() {
    const email = document.getElementById('login-email').value.trim();
    if (!email) return alert("Please enter email");
    const userDoc = await getDoc(doc(db, "users", email));
    if (userDoc.exists()) {
        currentUserEmail = email;
        localStorage.setItem("verifiedEmail", currentUserEmail);
        setupUserDashboard(userDoc.data());
        searchUsers();
        listenForNewMessages();
    } else { alert("❌ Account not found! Please Sign Up."); }
}

window.sendOTP = async function() {
    const emailInput = document.getElementById('email');
    const email = emailInput.value.trim();
    if (!email.includes('@')) return alert("Enter valid email");
    
    const userDoc = await getDoc(doc(db, "users", email));
    if (userDoc.exists()) { alert("Already registered! Please Login."); return; }
    
    generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
    otpExpiryTime = Date.now() + 60000; 

    emailjs.send('service_vc6a4pl', 'template_z4oiav3', { email: email, otp: generatedOTP, time: "60 Sec" })
        .then(() => { 
            alert("🚀 OTP Sent! Valid for 60 seconds."); 
            document.getElementById('otp-group').style.display = 'block'; 
            startOTPTimer(60); 
        })
        .catch((err) => {
            alert("Failed to send email. Check console.");
            console.error(err);
        });
}

window.verifyOTP = function() {
    const enteredOTP = document.getElementById('otp-input').value;
    if (Date.now() > otpExpiryTime) {
        alert("❌ OTP Expired! Please click Resend.");
        return;
    }

    if (enteredOTP === generatedOTP) {
        currentUserEmail = document.getElementById('email').value.trim();
        localStorage.setItem("verifiedEmail", currentUserEmail);
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('info-section').style.display = 'block';
    } else { alert("❌ Wrong OTP!"); }
}

// --- 5. PROFILE & SEARCH ---
window.saveProfile = async function() {
    const data = {
        name: document.getElementById('user-name').value,
        dept: document.getElementById('user-dept').value,
        branch: document.getElementById('user-branch-input').value, 
        sem: document.getElementById('user-sem').value,
        skills: document.getElementById('user-skills').value,
        email: currentUserEmail,
        blockedUsers: [] 
    };
    await setDoc(doc(db, "users", currentUserEmail), data);
    document.getElementById('info-section').style.display = 'none';
    setupUserDashboard(data);
    searchUsers();
}

// --- NEW FEATURE: DELETE MESSAGE ---
window.deleteMsg = async function(msgId) {
    if (confirm("Delete this message?")) {
        try {
            await deleteDoc(doc(db, "messages", msgId));
        } catch (e) {
            alert("Delete failed!");
        }
    }
}

// --- NEW FEATURE: BLOCK USER ---
window.blockUser = async function() {
    if (!chatWithEmail) return;
    if (confirm(`Block ${chatWithEmail}?`)) {
        await updateDoc(doc(db, "users", currentUserEmail), {
            blockedUsers: arrayUnion(chatWithEmail)
        });
        alert("User Blocked!");
        closeChat();
    }
}

// --- NEW FEATURE: UNBLOCK USER ---
window.unblockUser = async function(emailToUnblock) {
    await updateDoc(doc(db, "users", currentUserEmail), {
        blockedUsers: arrayRemove(emailToUnblock)
    });
    alert("User Unblocked!");
    openBlockList(); 
}

// --- NEW FEATURE: OPEN BLOCK LIST ---
window.openBlockList = async function() {
    const userDoc = await getDoc(doc(db, "users", currentUserEmail));
    const blockedList = userDoc.data().blockedUsers || [];
    const blockContainer = document.getElementById('block-list-container');
    
    if (blockContainer) {
        blockContainer.innerHTML = blockedList.length ? "" : "<p>No blocked users</p>";
        blockedList.forEach(email => {
            blockContainer.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                    <span>${email}</span>
                    <button onclick="unblockUser('${email}')" style="background:#ff4757; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Unblock</button>
                </div>`;
        });
    }
    document.getElementById('block-modal').style.display = 'flex';
}

window.closeBlockModal = () => { document.getElementById('block-modal').style.display = 'none'; }

window.searchUsers = async function() {
    const term = document.getElementById('search-bar').value.toLowerCase();
    const querySnapshot = await getDocs(collection(db, "users"));
    const listDiv = document.getElementById('users-list');
    listDiv.innerHTML = "";
    querySnapshot.forEach((doc) => {
        const user = doc.data();
        if (user.skills && user.skills.toLowerCase().includes(term) && user.email !== currentUserEmail) {
            listDiv.innerHTML += `
                <div class="user-card" onclick="viewProfile('${user.email}')">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="font-size: 2.2rem; background: #f1f5f9; border-radius: 50%; width: 65px; height: 65px; display: flex; align-items: center; justify-content: center;">👤</div>
                        <div style="flex:1;">
                            <div style="display:flex; justify-content:space-between; align-items:start;">
                                <strong style="font-size: 1.15rem; color: #0f172a;">${user.name || "Pietian"}</strong>
                                <span style="color: #007bff; font-size: 0.75rem; font-weight:800;">VIEW</span>
                            </div>
                            <div style="font-size: 0.85rem; color: #64748b;">${user.email}</div>
                        </div>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin: 5px 0;">
                        <span style="background:#eef2ff; color:#007bff; padding:4px 8px; border-radius:6px; font-size:0.75rem;">🏢 ${user.dept || 'N/A'}</span>
                        <span style="background:#eef2ff; color:#007bff; padding:4px 8px; border-radius:6px; font-size:0.75rem;">🎓 Sem ${user.sem || 'N/A'}</span>
                    </div>
                </div>`;
        }
    });
}

window.loadInbox = async function() {
    const dot = document.getElementById('nav-notify-dot');
    if(dot) dot.style.display = 'none';
    
    document.getElementById('search-section').style.display = 'none';
    document.getElementById('inbox-section').style.display = 'block';
    document.getElementById('btn-inbox').classList.add('active');
    document.getElementById('btn-search').classList.remove('active');

    const inboxList = document.getElementById('inbox-list');
    inboxList.innerHTML = "";
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    let chattedEmails = new Set();
    querySnapshot.forEach((doc) => {
        const m = doc.data();
        let otherUser = (m.sender === currentUserEmail) ? m.receiver : (m.receiver === currentUserEmail ? m.sender : null);
        if (otherUser && !chattedEmails.has(otherUser)) {
            chattedEmails.add(otherUser);
            renderInboxItem(otherUser);
        }
    });
}

async function renderInboxItem(email) {
    const userDoc = await getDoc(doc(db, "users", email));
    if (userDoc.exists()) {
        const user = userDoc.data();
        document.getElementById('inbox-list').innerHTML += `
            <div class="user-card" onclick="openChat('${user.email}', '${user.name}')" style="display:flex; justify-content:space-between; align-items:center; padding: 15px 20px !important;">
                <div style="display:flex; align-items:center; gap:15px;">
                    <div style="width:50px; height:50px; background:#eef2ff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">👤</div>
                    <div><strong style="color:#1e293b;">${user.name}</strong><br><small style="color:#64748b;">${user.email}</small></div>
                </div>
                <span style="color:#007bff; font-size:1.2rem;">💬</span>
            </div>`;
    }
}

window.viewProfile = async function(email) {
    const userDoc = await getDoc(doc(db, "users", email));
    if (userDoc.exists()) {
        const user = userDoc.data();
        document.getElementById('view-name').innerText = user.name || "";
        document.getElementById('view-email').innerText = user.email || "";
        document.getElementById('view-dept').innerText = user.dept || "";
        document.getElementById('view-branch').innerText = user.branch || "";
        document.getElementById('view-sem').innerText = user.sem || "";
        document.getElementById('view-skills').innerText = user.skills || "";
        document.getElementById('start-chat-btn').onclick = () => { closeProfile(); openChat(user.email, user.name); };
        document.getElementById('profile-modal').style.display = 'flex';
    }
}

window.closeProfile = () => { document.getElementById('profile-modal').style.display = 'none'; }

window.openChat = function(email, name) {
    chatWithEmail = email;
    const dot = document.getElementById('nav-notify-dot');
    if(dot) dot.style.display = 'none';
    document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-box').style.display = 'flex';
    loadMessages();
}

window.closeChat = () => { document.getElementById('chat-box').style.display = 'none'; if(unsubscribeChat) unsubscribeChat(); }

window.sendMessage = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const otherUserDoc = await getDoc(doc(db, "users", chatWithEmail));
    const otherBlockedList = otherUserDoc.data().blockedUsers || [];
    if (otherBlockedList.includes(currentUserEmail)) {
        alert("You are blocked by this user.");
        return;
    }

    await addDoc(collection(db, "messages"), {
        sender: currentUserEmail,
        receiver: chatWithEmail,
        text: text,
        timestamp: serverTimestamp() 
    });
    input.value = "";
}

function loadMessages() {
    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    unsubscribeChat = onSnapshot(q, async (snapshot) => {
        const myDoc = await getDoc(doc(db, "users", currentUserEmail));
        const myBlocks = myDoc.data().blockedUsers || [];

        const msgDiv = document.getElementById('messages');
        msgDiv.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const m = docSnap.data();
            const msgId = docSnap.id;

            if (myBlocks.includes(m.sender)) return;

            if ((m.sender === currentUserEmail && m.receiver === chatWithEmail) || (m.sender === chatWithEmail && m.receiver === currentUserEmail)) {
                const isMine = m.sender === currentUserEmail;
                msgDiv.innerHTML += `
                    <div style="align-self: ${isMine ? 'flex-end' : 'flex-start'}; 
                                background: ${isMine ? '#007bff' : 'white'}; 
                                color: ${isMine ? 'white' : '#1e293b'}; 
                                padding: 12px 16px; border-radius: ${isMine ? '20px 20px 4px 20px' : '20px 20px 20px 4px'}; 
                                margin-bottom: 8px; max-width: 75%; box-shadow: 0 2px 5px rgba(0,0,0,0.05); 
                                font-size: 0.95rem; cursor: pointer;" 
                         ${isMine ? `onclick="deleteMsg('${msgId}')"` : ""}>
                        ${m.text}
                        ${isMine ? '<div style="font-size:8px; opacity:0.6; text-align:right;">Click to delete</div>' : ''}
                    </div>`;
            }
        });
        msgDiv.scrollTop = msgDiv.scrollHeight;
    });
}

window.logout = () => { localStorage.removeItem("verifiedEmail"); location.reload(); }

window.openEditProfile = async function() {
    const userDoc = await getDoc(doc(db, "users", currentUserEmail));
    if (userDoc.exists()) {
        const user = userDoc.data();
        document.getElementById('edit-name').value = user.name || "";
        document.getElementById('edit-dept').value = user.dept || "";
        document.getElementById('edit-branch').value = user.branch || "";
        document.getElementById('edit-sem').value = user.sem || "";
        document.getElementById('edit-skills').value = user.skills || "";
        document.getElementById('edit-profile-modal').style.display = 'flex';
    }
}

window.closeEditModal = () => { document.getElementById('edit-profile-modal').style.display = 'none'; }

// --- UPDATED UPDATE PROFILE FUNCTION ---
window.updateProfile = async function() {
    const updatedData = {
        name: document.getElementById('edit-name').value, 
        dept: document.getElementById('edit-dept').value,
        branch: document.getElementById('edit-branch').value,
        sem: document.getElementById('edit-sem').value,
        skills: document.getElementById('edit-skills').value,
        email: currentUserEmail
    };
    try {
        await updateDoc(doc(db, "users", currentUserEmail), updatedData);
        alert("✨ Profile Updated!");
        closeEditModal();
        setupUserDashboard(updatedData);
        searchUsers();
    } catch (e) { alert("❌ Update failed: " + e.message); }
}

function setupUserDashboard(userData) {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('app-sidebar').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('my-profile-name').innerText = userData.name || "Pietian";
    document.getElementById('my-profile-dept').innerText = userData.dept || userData.branch || "Student";
}

// --- Exporting functions ---
window.sendOTP = sendOTP;
window.verifyOTP = verifyOTP;
window.handleLogin = handleLogin;
window.saveProfile = saveProfile;
window.searchUsers = searchUsers;
window.loadInbox = loadInbox;
window.sendMessage = sendMessage;
window.updateProfile = updateProfile;
window.deleteMsg = deleteMsg;
window.blockUser = blockUser;
window.unblockUser = unblockUser;
window.openBlockList = openBlockList;
window.closeBlockModal = closeBlockModal;
window.openEditProfile = openEditProfile;