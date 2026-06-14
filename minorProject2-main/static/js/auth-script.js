
let signupData = {}; // Temp storage for Step 1

// --- VIEW SWITCHING & UI ---
function switchView(viewName) {
    //there maybe more than one view-section
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active')); 
    document.getElementById(`view-${viewName}`).classList.add('active');
    clearErrors();
}

function clearErrors() {
    document.querySelectorAll('.error-msg').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.auth-input').forEach(el => el.classList.remove('error'));
    const alertBox = document.getElementById('loginAlert');
    if (alertBox) alertBox.style.display = 'none';
}

function showError(inputId, msgId, show) {
    const input = document.getElementById(inputId);
    const msg = document.getElementById(msgId);
    if (show) {
        input.classList.add('error');
        msg.classList.add('show');
    } else {
        input.classList.remove('error');
        msg.classList.remove('show');
    }
    return !show; // Returns true if valid (error NOT shown)
}

// Clear alerts when typing
document.querySelectorAll('.auth-input').forEach(input => {
    input.addEventListener('input', () => clearErrors());
});


async function handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById('loginId').value.trim();
    const pass = document.getElementById('loginPass').value;
    
    // Get both the Box (for color) and the Span (for text)
    const alertBox = document.getElementById('loginAlert');
    const alertMsg = document.getElementById('loginAlertMsg');
    const alertIcon = alertBox.querySelector('i'); // Get the icon to change it dynamically

    let valid = true;
    valid &= showError('loginId', 'loginIdError', id.length === 0);
    valid &= showError('loginPass', 'loginPassError', pass.length === 0);

    if (valid) {
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id, password: pass })
            });

            const result = await response.json();

            if (response.ok) {
                // SUCCESS STATE
                alertBox.style.display = 'block';
                alertBox.style.backgroundColor = '#e8f5e923'; // Light Green
                alertBox.style.color = '#2e7d32'; // Dark Green
                alertBox.style.border = '1px solid #a5d6a7';
                
                // Switch icon to checkmark
                alertIcon.className = 'fas fa-check-circle';
                alertIcon.style.marginRight = '8px';
                
                alertMsg.textContent = "Login Successful! Redirecting...";

                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            } else {
                // ERROR STATE
                alertBox.style.display = 'block';
                alertBox.style.backgroundColor = '#ffebee18'; // Light Red
                alertBox.style.color = '#c93e3eff'; // Dark Red
                alertBox.style.border = '1px solid #ef9a9a33';
                
                // Switch icon to warning triangle
                alertIcon.className = 'fas fa-exclamation-triangle';
                alertIcon.style.marginRight = '8px';

                alertMsg.textContent = result.message;
                
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            // NETWORK ERROR STATE
            alertBox.style.display = 'block';
            alertBox.style.backgroundColor = '#ffebee';
            alertBox.style.color = '#c62828';
            alertIcon.className = 'fas fa-wifi'; // Wifi Error Icon
            alertMsg.textContent = "Server connection failed.";
            
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

// --- 2. SIGNUP LOGIC ---

function handleSignupNext(e) {
    e.preventDefault();
    const first = document.getElementById('suFirst').value.trim();
    const last = document.getElementById('suLast').value.trim();
    const email = document.getElementById('suEmail').value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let valid = true;
    valid &= showError('suFirst', 'suFirstError', first.length === 0);
    valid &= showError('suLast', 'suLastError', last.length === 0);
    valid &= showError('suEmail', 'suEmailError', !emailRegex.test(email));

    if (valid) {
        signupData.first_name = first;
        signupData.last_name = last;
        signupData.email = email;
        switchView('signup-step2');
    }
}
async function handleSignupSubmit(e) {
    e.preventDefault();
    const user = document.getElementById('suUser').value.trim();
    const pass = document.getElementById('suPass').value;
    const confirm = document.getElementById('suConfirm').value;

    let valid = true;
    valid &= showError('suUser', 'suUserError', user.length < 3);
    valid &= showError('suPass', 'suPassError', pass.length < 6);
    valid &= showError('suConfirm', 'suConfirmError', (pass !== confirm || pass.length === 0));

    if (valid) {
        const btn = e.target.querySelector('button[type="submit"]');
        const oldText = btn.innerHTML; // <--- CAPTURE ORIGINAL HTML
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        btn.disabled = true;

        const fullPayload = {
            ...signupData,
            username: user,
            password: pass
        };

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fullPayload)
            });

            const result = await response.json();

            if (response.ok) {
                    window.location.href = '/login?success=true';
            } else {
                showPopup(result.message || "Registration failed", "failed");
                btn.innerHTML = oldText; // <--- RESTORE ORIGINAL HTML
                btn.disabled = false;
            }
        } catch (error) {
            showPopup("Connection error to backend.", "failed");
            btn.innerHTML = oldText; // <--- RESTORE ORIGINAL HTML
            btn.disabled = false;
        }
    }
}


// Helper for Real-time Checking
let typingTimer;
const doneTypingInterval = 500; // Wait 500ms after typing stops
// --- CHECK EMAIL AVAILABILITY ---
const emailInput = document.getElementById('suEmail');
const emailError = document.getElementById('suEmailError');
const emailSuccess = document.getElementById('suEmailSuccess');
const step1Btn = document.querySelector('#view-signup-step1 button[type="submit"]');

emailInput.addEventListener('input', () => {
    clearTimeout(typingTimer);
    
    // 1. IMMEDIATE RESET: Clear all signals while user is typing
    emailError.classList.remove('show');
    emailSuccess.classList.remove('show');
    emailInput.classList.remove('error', 'success');
    
    // Disable button by default until we re-verify
    step1Btn.disabled = true;
    step1Btn.style.opacity = "0.5";

    typingTimer = setTimeout(async () => {
        const email = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        // 2. VALIDATION CHECK: Only ping the server if it's a valid-looking email
        if (emailRegex.test(email)) {
            try {
                const res = await fetch('/api/check-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });

                if (!res.ok) throw new Error("Server error");
                const data = await res.json();

                if (data.exists) {
                    // Email is real but already in database
                    emailError.textContent = "Email is already registered!";
                    emailError.classList.add('show');
                    emailInput.classList.add('error');
                } 
                else {
                    // SUCCESS: Domain is real and email is unique
                    emailSuccess.innerHTML = '<i class="fas fa-check-circle"></i> Email is verified!';
                    emailSuccess.classList.add('show');
                    emailInput.classList.add('success');
                    
                    step1Btn.disabled = false;
                    step1Btn.style.opacity = "1";
                }
            } catch (error) {
                console.error("Network Error:", error);
                // Fail gracefully: don't block the user if the DNS check fails due to internet lag
                step1Btn.disabled = false;
                step1Btn.style.opacity = "1";
            }
        }
    }, doneTypingInterval);
});


// --- CHECK USERNAME AVAILABILITY ---
const userInput = document.getElementById('suUser');
const userError = document.getElementById('suUserError');
const userSuccess = document.getElementById('suUserSuccess');
const submitBtn = document.querySelector('#view-signup-step2 button[type="submit"]');

userInput.addEventListener('input', () => {
    clearTimeout(typingTimer);
    userError.classList.remove('show');
    userInput.classList.remove('error', 'success');
    
    typingTimer = setTimeout(async () => {
        const username = userInput.value.trim();
        if (username.length >= 3) {
            const res = await fetch('/api/check-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username })
            });
            const data = await res.json();
            
            if (data.exists) {
                userError.textContent = "Username already taken!";
                userError.classList.add('show');
                userInput.classList.add('error');
                submitBtn.disabled = true;
                submitBtn.style.opacity = "0.5";
            } else {
                userSuccess.innerHTML = '<i class="fas fa-check-circle"></i> Username is available!';
                userSuccess.classList.add('show');
                userInput.classList.add('success');
                submitBtn.disabled = false;
                submitBtn.style.opacity = "1";
            }
        }
    }, doneTypingInterval);
});




async function handleForgotRequest(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (showError('forgotEmail', 'forgotEmailError', !emailRegex.test(email))) {
        const btn = e.target.querySelector('button');
        const oldText = btn.innerHTML;
        btn.innerHTML = 'Sending...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });

            if (res.ok) {
                showPopup(`Code sent to ${email}`, "success");
                switchView('reset-final');
            } else {
                const errorData = await res.json(); // Try to get error message from Flask
                showPopup(errorData.message || "Email not found in our system.", "failed");
                btn.innerHTML = oldText;
                btn.disabled = false;
            }
        } catch (error) {
            // This block catches ERR_INTERNET_DISCONNECTED or Server Down
            console.error("Network Error:", error);
            showPopup("Connection to server failed. Please check if the backend is running.", "failed");
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    }
}


// --- 4. RESET PASSWORD FINAL LOGIC ---
async function handleFinalReset(e) {
    e.preventDefault();
    const otp = document.getElementById('resetOtp').value;
    const newPass = document.getElementById('newPass').value;
    const confirm = document.getElementById('confirmNewPass').value;

    let valid = true;
    valid &= showError('resetOtp', 'resetOtpError', otp.length !== 6);
    valid &= showError('newPass', 'newPassError', newPass.length < 6);
    valid &= showError('confirmNewPass', 'confirmNewPassError', newPass !== confirm);

    if (valid) {
        const btn = e.target.querySelector('button');
        const oldText = btn.innerHTML; // <--- CAPTURE ORIGINAL HTML
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; // Added Spinner
        btn.disabled = true;

        try {
            const res = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    otp: otp,
                    password: newPass
                })
            });

            // Handle non-JSON responses (like 500 errors) gracefully
            let result;
            try {
                 result = await res.json();
            } catch (err) {
                 result = { message: "Server error occurred." };
            }

            if (res.ok) {
                showPopup("Password Updated Successfully! Please Login.", "success");
                switchView('login');
                // Optional: Restore button here if user navigates back, though view switch hides it
                btn.innerHTML = oldText;
                btn.disabled = false;
            } else {
                showPopup(result.message || "Invalid Code or it has expired.", "failed");
                btn.innerHTML = oldText; // <--- RESTORE ORIGINAL HTML
                btn.disabled = false;
            }
        } catch (error) {
            showPopup("Connection Failed!", "failed");
            btn.innerHTML = oldText; // <--- RESTORE ORIGINAL HTML
            btn.disabled = false;
        }
    }
}



let popupTimeout; // Variable to track the timer

function showPopup(message, type = "success") {
    const popup = document.querySelector('.popup-window');
    const icon = document.getElementById('popup-window-icon');
    const text = document.getElementById('popup-window-text');
    const progressBar = document.querySelector('.popup-progress-bar');

    // 1. Set Message
    text.innerText = message;

    // 2. Styling based on Success vs Error
    if (type === "success") {
        popup.style.background = "linear-gradient(135deg, #2ecc71, #27ae60)"; // Green
        icon.className = "fa-solid fa-circle-check";
    } else {
        popup.style.background = "linear-gradient(135deg, #e74c3c, #c0392b)"; // Red for errors
        icon.className = "fa-solid fa-circle-xmark";
    }

    // 3. Reset Animation (The Trick)
    // We clone the progress bar and replace it to force the CSS animation to restart
    const newProgressBar = progressBar.cloneNode(true);
    progressBar.parentNode.replaceChild(newProgressBar, progressBar);

    // 4. Show Popup
    popup.classList.add('show');

    // 5. Handle Timer
    if (popupTimeout) clearTimeout(popupTimeout);

    // Matches the 3s CSS animation
    popupTimeout = setTimeout(() => {
        popup.classList.remove('show');
    }, 2000);
}


window.onload = function() {
    // 1. Get the URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    // 2. Check if 'success' exists and is 'true'
    if (urlParams.get('success') === 'true') {
        showPopup("Registration Successful! Please Login.", "success");
        
        // Optional: Clean up the URL so the popup doesn't show again if they refresh
        window.history.replaceState(null, null, window.location.pathname);
    }
};


function togglePassword(inputId, iconElement) {
    const input = document.getElementById(inputId);
    
    if (input.type === "password") {
        input.type = "text";
        // Switch to the 'Eye Open' icon
        iconElement.classList.remove('fa-eye-slash');
        iconElement.classList.add('fa-eye');
    } else {
        input.type = "password";
        // Switch back to 'Eye Slash' (hidden) icon
        iconElement.classList.remove('fa-eye');
        iconElement.classList.add('fa-eye-slash');
    }
}