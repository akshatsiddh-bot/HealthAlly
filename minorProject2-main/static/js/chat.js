// --- 1. GLOBAL VARIABLES (Must be at the top) ---
let map = null;             // <--- GLOBAL MAP VARIABLE
let userLat, userLon;
let allMarkers = [];
let currentLayer = null;
let userMarker = null;
let searchRadius = 20000; 

// API Keys
const mapTilerKey = "do6bSy9YpCy80d57MWft";
const tomtomKey = "rHHOGnU2FUZnvbzgKltigFjIXNjUv3ht";

// Define the icon
const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});


function closeMap() {
    const mapArea = document.getElementById('map-modal');
    mapArea.classList.remove('nav-open');
}

// --- OPTIMIZED MAIN FUNCTION ---
function openMapInterface(specialist) {
    const searchQuery = specialist || "Hospital"; 
    const mapArea = document.getElementById('map-modal');
    mapArea.classList.toggle('nav-open');

    // 1. OPTIMIZATION: Reduce wait time for the "Grey Area" fix
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 500); // Reduced from 500 to 200

    // Initialize Map if it doesn't exist
    if (!map) {
        // 2. OPTIMIZATION: Start view at India [22, 78] instead of Ocean [0,0]
        // This prevents loading useless blue ocean tiles
        map = L.map('map').setView([22.9734, 78.6569], 5); 
        
        const root = document.documentElement;
        const currentTheme = root.getAttribute('data-theme') || 'light';
        const initialStyle = currentTheme === 'dark' ? 'streets-v2-dark' : 'streets-v2';

        currentLayer = L.tileLayer(`https://api.maptiler.com/maps/${initialStyle}/{z}/{x}/{y}.png?key=${mapTilerKey}`, {
            attribution: '© MapTiler © OpenStreetMap contributors'
        }).addTo(map);
    }

    // 3. OPTIMIZATION: Check if we already have the location (Caching)
    if (userLat && userLon) {
        // We already have location, just fly there immediately
        const userLocation = [userLat, userLon];
        performFlyTo(userLocation);
        findSpecialists(userLat, userLon, searchQuery);
    } 
    // If no location, THEN ask the browser (Slow operation)
    else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            userLat = latitude;
            userLon = longitude;
            const userLocation = [latitude, longitude];

            // Create User Marker
            if (!userMarker) {
                userMarker = L.marker(userLocation).addTo(map).bindPopup("You are here");
            } else {
                userMarker.setLatLng(userLocation);
            }

            performFlyTo(userLocation);
            findSpecialists(latitude, longitude, searchQuery);

        }, error => {
            console.error("Geolocation error:", error);
            const loader = document.getElementById('loadingOverlay');
            if(loader) loader.classList.add('hidden');
            alert("Please enable location access.");
        });
    } else {
        alert("Geolocation not supported.");
    }
}

// Helper for smoother, faster animation
function performFlyTo(location) {
    map.flyTo(location, 14, {
        duration: 0.5, // OPTIMIZATION: Faster animation (was 2.5)
        easeLinearity: 0.25
    });
}
// --- 3. SEARCH FUNCTION ---
function findSpecialists(lat, lon, query) {
    console.log(`Searching for: ${query}`); // Debugging line

    const tomtomUrl = `https://api.tomtom.com/search/2/poiSearch/${encodeURIComponent(query)}.json?key=${tomtomKey}&lat=${lat}&lon=${lon}&radius=${searchRadius}&categorySet=7321&limit=15`;

    fetch(tomtomUrl)
        .then(res => res.json())
        .then(data => {
            if (data.results && data.results.length > 0) {
                renderMarkers(data.results);
            } else {
                console.log("No specific specialist found, searching for general clinics...");
                // Fallback search
                fetch(`https://api.tomtom.com/search/2/poiSearch/Clinic.json?key=${tomtomKey}&lat=${lat}&lon=${lon}&radius=${searchRadius}&limit=10`)
                    .then(res => res.json())
                    .then(fallbackData => {
                        if (fallbackData.results && fallbackData.results.length > 0) {
                            renderMarkers(fallbackData.results);
                        } else {
                            const loader = document.getElementById('loadingOverlay');
                            if(loader) loader.classList.add('hidden');
                            alert(`No medical facilities found nearby.`);
                        }
                    });
            }
        })
        .catch(error => {
            console.error("TomTom API error:", error);
            const loader = document.getElementById('loadingOverlay');
            if(loader) loader.classList.add('hidden');
        });
}

function renderMarkers(results) {
    if (!userLat || !userLon || !map) return;

    allMarkers.forEach(marker => map.removeLayer(marker));
    allMarkers = [];

    results.forEach(doctor => {
        const docPos = [doctor.position.lat, doctor.position.lon];
        const marker = L.marker(docPos, { icon: redIcon }).addTo(map);
        allMarkers.push(marker);

        // Click marker to open Sidebar
        marker.on('click', () => {
            showSidePanel(doctor);
            map.flyTo(docPos, 16);
        });
    });
}

function showSidePanel(doctor) {
    const panel = document.getElementById('side-panel');
    const content = document.getElementById('panel-content');
    const distance = calculateDistance(userLat, userLon, doctor.position.lat, doctor.position.lon).toFixed(1);
    
    // Mocking ratings/images to match UI
    const rating = (Math.random() * (5 - 4) + 4).toFixed(1);
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${doctor.position.lat},${doctor.position.lon}`;

    content.innerHTML = `
        <div class="panel-body">
            <h6 class="panel-title">${doctor.poi.name}</h6>
            <div class="panel-rating">${rating}</div>
            • <span style="color:">Open</span>
            <p style="color:#c4c7c5; font-size:14px; margin-bottom:15px;">📍 ${distance} km • ${doctor.address.freeformAddress}</p>
    
            <div class="panel-actions">
                <button onclick="window.location.href='${googleMapsUrl}'" target="_blank" class="action-btn">Directions</button>
                <button class="action-btn">Share</button>
            </div>

            <a href="${googleMapsUrl}" target="_blank" class="google-maps-btn">Open in Google Maps</a>
        </div>
    `;

    panel.classList.add('active');
}

function closeSidePanel() {
    document.getElementById('side-panel').classList.remove('active');
}

function changeMapTheme(themeName) {
    if (!map) return; 

    const apiKey = mapTilerKey;
    let styleUrl;

    if (themeName === 'dark') {
        styleUrl = `https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key=${apiKey}`;
    } else {
        styleUrl = `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${apiKey}`;
    }

    // Remove the old layer
    if (currentLayer) {
        map.removeLayer(currentLayer);
    }

    // Add new layer
    currentLayer = L.tileLayer(styleUrl, {
        tileSize: 512,
        zoomOffset: -1,
        minZoom: 1,
        attribution: '© MapTiler',
        crossOrigin: true
    }).addTo(map);
}

// Calculate distance (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Update statistics
function updateStats(count, nearest, distances) {
    document.getElementById('totalCount').textContent = count;
    document.getElementById('nearestDistance').textContent = nearest < Infinity ? nearest.toFixed(1) : '--';

    if (distances.length > 0) {
        const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
        document.getElementById('avgDistance').textContent = avg.toFixed(1);
    }
}


let currentChatId = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chatContainer').innerHTML = WELCOME_HTML;
    loadChatHistorySidebar();

    document.getElementById('userMessage').addEventListener('input', (e) => {
        document.getElementById('sendBtn').classList.toggle('active', e.target.value.trim().length > 0);
        document.getElementById('micBtn').classList.toggle('disable', e.target.value.trim().length > 0);
    });
});

async function typeWriter(element, text, isReport = false) {
    let reportBox = null;
    let disclaimerArea = null;

    if (isReport) {
        // Split the text at the separator
        const parts = text.split("---");
        const reportContent = parts[0];
        const disclaimerContent = "Disclaimer: This response is for informational purposes only and is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always consult with a healthcare professional for personalized advice and care.";

        // Create the structure immediately so the box is visible
        // Note: Removed fixed IDs to prevent duplicates in chat history
        element.innerHTML = `<div class="report-box"></div><div class="disclaimer-area"></div>`;

        // Select the specific elements inside this message bubble
        reportBox = element.querySelector('.report-box');
        disclaimerArea = element.querySelector('.disclaimer-area');

        // 1. Type the report content first
        await typeSteps(reportBox, reportContent);

        // --- NEW: DETECT SPECIALIST & APPEND BUTTON ---
        const match = text.match(/Recommended Specialist:\*\*?\s*(.*?)(\n|<br>|$)/i);
        if (match && match[1]) {
            const specialist = match[1].replace(/\*/g, '').trim();


            const card = document.createElement('div');
            card.className = 'map-card';

            card.innerHTML = `
                            <div class="map-visual-section">
                                <div class="map-stars"></div>
                                <div class="map-glow-overlay"></div>

                                <i class="fas fa-stethoscope map-prop-stethoscope"></i>

                                <i class="fas fa-briefcase-medical map-prop-kit"></i>

                                <div class="map-center-marker">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <div class="map-pulse"></div>
                                </div>
                            </div>

                            <div class="map-details">
                                <div class="map-title">Nearby ${specialist}s</div>
                                <div class="map-desc">Found 3 specialists near Patrakar Colony. Click to view availability.</div>
                                <div class="map-btn">
                                    View on interactive map <i class="fas fa-chevron-right"></i>
                                </div>
                            </div>
                            <div class="disclaimer-area"></div>`;
            card.onclick = () => openMapInterface(specialist);

            reportBox.appendChild(card);

            // Scroll to make sure button is visible
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        // 2. Then type the disclaimer
        if (disclaimerArea && disclaimerContent) {
            await typeSteps(disclaimerArea, disclaimerContent);
        }

    } else {
        // Normal chat typing
        await typeSteps(element, text);
    }
}

// Helper function to handle the actual typing steps
async function typeSteps(targetElement, fullText) {
    const words = fullText.split(' ');
    let currentText = "";

    for (const word of words) {
        currentText += word + " ";
        // Use marked.parse to ensure the box doesn't break during typing
        targetElement.innerHTML = marked.parse(currentText);
        scrollToBottom();
        await new Promise(resolve => setTimeout(resolve, 35));
    }
}

function appendMessage(role, text, animate = false) {
    const container = document.getElementById('chatContainer');
    const div = document.createElement('div');
    div.className = `message-row ${role === 'user' ? 'user' : 'bot'}`;

    let displayText = text;
    try {
        const parsed = JSON.parse(text);
        if (parsed.message) displayText = parsed.message;
    } catch (e) { displayText = text; }

    if (role === 'user') {
        div.innerHTML = `<div class="bubble user">${marked.parse(displayText)}</div>`;
        container.appendChild(div);
    } else {
        div.innerHTML = `<div class="bot-icon"><div class="cssload-inner cssload-one"></div><div class="cssload-inner cssload-two"></div><div class="cssload-inner cssload-three"></div></div><div class="bubble bot"></div>`;
        container.appendChild(div);
        const bubble = div.querySelector('.bubble');

        const isReport = displayText.includes("Medical Assessment");

        if (animate) {
            typeWriter(bubble, displayText, isReport);
        } else {
            // Static rendering for history
            if (isReport) {
                const parts = displayText.split("---");

                // 1. Extract Specialist Name (e.g., "Cardiologist")
                const match = displayText.match(/Recommended Specialist:\*\*?\s*(.*?)(\n|<br>|$)/i);
                const specialist = match ? match[1].replace(/\*/g, '').trim() : 'Doctor';

                // 2. Render HTML with the Button added inside the report-box
                bubble.innerHTML = `<div class="report-box">
                                        ${marked.parse(parts[0])}
                                        <div class="map-card" onclick="openMapInterface('${specialist}')">
                                            <div class="map-visual-section">
                                                
                                                <div class="map-stars"></div>
                                                <div class="map-glow-overlay"></div>

                                                <i class="fas fa-stethoscope map-prop-stethoscope"></i>

                                                <i class="fas fa-briefcase-medical map-prop-kit"></i>

                                                <div class="map-center-marker">
                                                    <i class="fas fa-map-marker-alt"></i>
                                                    <div class="map-pulse"></div>
                                                </div>
                                            </div>

                                            <div class="map-details">
                                                <div class="map-title">Nearby ${specialist}s</div>
                                                <div class="map-desc">Found 3 specialists near Patrakar Colony. Click to view availability.</div>
                                                <div class="map-btn">
                                                    View on interactive map <i class="fas fa-chevron-right"></i>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="disclaimer-area">Disclaimer: This response is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult with a healthcare professional for health care.</div>
                                    </div>
                                `;
            } else {
                bubble.innerHTML = marked.parse(displayText);
            }
        }
    }
    scrollToBottom();
}

// 1. ON LOAD: Force center state if it's a new chat
document.addEventListener('DOMContentLoaded', () => {
    // If there are no messages (or only welcome screen), add center state
    if (!document.querySelector('.message-row')) {
        document.body.classList.add('center-state');
    }
});

document.getElementById('chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('userMessage');
    const message = input.value.trim();
    if (!message) return;

    // 2. ON SEND: Remove center state immediately
    // This triggers the CSS transition to slide the bar down to the bottom
    document.body.classList.remove('center-state');

    if (document.getElementById('welcomeScreen')) document.getElementById('welcomeScreen').remove();

    appendMessage('user', message);
    input.value = '';
    document.getElementById('sendBtn').classList.remove('active');

    if (!currentChatId) {
        const res = await fetch('/api/new_chat', { method: 'POST' });
        const data = await res.json();
        currentChatId = data.chat_id;
    }

    // Show Loading Indicator
    const loadingId = 'loading-' + Date.now();
    document.getElementById('chatContainer').insertAdjacentHTML('beforeend', `
        <div class="message-row bot" id="${loadingId}">
            <div class="bot-icon"></div>
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `);
    scrollToBottom();

    try {
        const res = await fetch('/api/send_message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: currentChatId, message: message })
        });
        const data = await res.json();
        document.getElementById(loadingId).remove();

        // Append message with typing animation
        appendMessage('model', data.reply, true);

        // Update title if needed
        if (document.getElementById('topTitle').innerText === "New Chat") {
            await fetch('/api/generate_title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: currentChatId, message_content: message })
            });
            loadChatHistorySidebar();
            document.getElementById('topTitle').innerText = message.substring(0, 16) + "...";
        }
    } catch (err) {
        document.getElementById(loadingId).remove();
        appendMessage('model', "Sorry, I encountered an error connecting to the server.");
    }
});


document.addEventListener('DOMContentLoaded', () => {
    const micBtn = document.getElementById('micBtn');
    const messageInput = document.getElementById('userMessage');
    const sendBtn = document.getElementById('sendBtn');

    // 1. Check if browser supports Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        
        // Settings
        //recognition.continuous = false;      // Stop listening after the user stops speaking
        recognition.lang = 'en-US';          // Set language (you can change this)
        //recognition.interimResults = false;  // Only show final results

        // 2. Toggle Recording on Button Click
        micBtn.addEventListener('click', () => {
            if (micBtn.classList.contains('is-listening')) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });

        // 3. Update UI when recording starts
        recognition.onstart = () => {
            micBtn.classList.add('is-listening');
            micBtn.innerHTML = '<i class="fa-solid fa-stop"></i>'; // Change icon to Stop
            messageInput.value = "";
            messageInput.placeholder = "Listening";
        };

        // 4. Update UI when recording ends
        recognition.onend = () => {
            micBtn.classList.remove('is-listening');
            micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>'; // Reset icon
            messageInput.placeholder = "Ask HealthAlly";
        };

        // 5. Handle the result (The Voice Text)
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            
            // Add the text to the input field
            messageInput.value = transcript;

            // IMPORTANT: Manually trigger the 'input' event 
            // This ensures your Send button becomes active (from your previous code)
            const inputEvent = new Event('input');
            messageInput.dispatchEvent(inputEvent);
            
            // Optional: Auto-focus the input
            messageInput.focus();
        };

        // Handle Errors
        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            micBtn.classList.remove('is-listening');
        };

    } else {
        // Fallback if browser doesn't support it
        console.warn("Web Speech API not supported in this browser.");
        micBtn.style.display = 'none'; // Hide the button if not supported
    }
});

// --- REST OF ORIGINAL FUNCTIONS ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // --- MOBILE LOGIC ---
        // We use the 'active' class to slide the menu in/out
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        
        // Ensure we don't accidentally keep the 'collapsed' class from desktop resize
        sidebar.classList.remove('collapsed'); 
    } else {
        // --- DESKTOP LOGIC ---
        // We use the 'collapsed' class to shrink the menu
        sidebar.classList.toggle('collapsed');
        
        // Clean up mobile classes just in case window was resized
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }
}

// Add a listener to close sidebar when clicking the overlay (Mobile only)
document.getElementById('overlay').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
});

function toggleSettings(e) { 
    e.stopPropagation(); 
    document.getElementById('settingsMenu').classList.toggle('show'); 
}

async function loadChatMessages(chatId, title) {
    currentChatId = chatId;
    document.getElementById('topTitle').innerText = title || "Chat";

    // Removing the maparea for new chat 
    document.getElementById('map-modal').classList.remove('nav-open')

    // --- START NEW LOGIC ---
    // 1. Remove 'active' from the previously active item
    const prevActive = document.querySelector('.history-item.active');
    if (prevActive) {
        prevActive.classList.remove('active');
    }

    // 2. Add 'active' to the new item using the data-id we added in Step 1
    const newActive = document.querySelector(`.history-item[data-id="${chatId}"]`);
    if (newActive) {
        newActive.classList.add('active');
    }
    // --- END NEW LOGIC ---

    const container = document.getElementById('chatContainer');
    container.innerHTML = '<div class="cssload-loader"><div class="cssload-inner cssload-one"></div><div class="cssload-inner cssload-two"></div><div class="cssload-inner cssload-three"></div></div>';

    try {
        const res = await fetch(`/api/get_messages/${chatId}`);
        const messages = await res.json();
        container.innerHTML = '';
        messages.forEach(msg => appendMessage(msg.role, msg.content, false));
        scrollToBottom();
    } catch (e) { 
        console.error(e); 
    }

    if (window.innerWidth <= 768) 
        toggleSidebar();

    updateInputPosition()
}

async function loadChatHistorySidebar() {
    try {
        const res = await fetch('/api/get_chats');
        const chats = await res.json();
        const list = document.getElementById('chatHistoryList');
        list.innerHTML = '<div class="section-label">Recent</div>';

        chats.forEach(chat => {
            // Check if this chat is the one currently open
            const isActive = currentChatId === chat.chat_id ? 'active' : '';

            const item = document.createElement('div');
            // ADDED: data-id attribute for easy selection
            item.className = `history-item ${isActive}`;
            item.setAttribute('data-id', chat.chat_id);

            item.innerHTML = `
        <span class="text-label" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${chat.title || 'New Chat'}</span>
        <i class="fas fa-ellipsis-v chat-options-btn" onclick="toggleChatMenu(event, ${chat.chat_id})"></i>
        <div class="chat-menu-dropdown" id="menu-${chat.chat_id}">
            <div class="chat-menu-item" onclick="renameChat(${chat.chat_id}, event)"><i class="fa-regular fa-pen-to-square"></i> Rename</div>
            <div class="chat-menu-item delete" onclick="deleteChat(${chat.chat_id}, event)"><i class="fa-regular fa-trash-can"></i> Delete</div>
        </div>`;

            item.onclick = (e) => {
                if (!e.target.closest('.chat-options-btn')) loadChatMessages(chat.chat_id, chat.title);
            };
            list.appendChild(item);
        });
    } catch (e) { 

    }
}

function resetToNewChat() {
    currentChatId = null;
    document.getElementById('chatContainer').innerHTML = WELCOME_HTML;
    document.getElementById('topTitle').innerText = "New Chat";

    updateInputPosition();
    if (window.innerWidth <= 768) toggleSidebar();
}

function updateInputPosition() {
    const chatContainer = document.getElementById('chatContainer');
    
    // Check if there are any actual messages (excluding the welcome screen)
    const hasMessages = chatContainer.querySelectorAll('.message-row').length > 0;

    if (hasMessages) {
        // If messages exist, input MUST be at the bottom
        document.body.classList.remove('center-state');
    } else {
        // If no messages (empty or welcome screen), input MUST be in center
        document.body.classList.add('center-state');
    }
}

function scrollToBottom() {
    const c = document.querySelector('.chat-container');
    c.scrollTop = c.scrollHeight;
}

function toggleChatMenu(e, id) {
    e.stopPropagation();
    document.querySelectorAll('.chat-menu-dropdown').forEach(el => el.classList.remove('show'));
    document.getElementById(`menu-${id}`).classList.toggle('show');
}

window.onclick = () => {
    document.getElementById('settingsMenu').classList.remove('show');
    document.querySelectorAll('.chat-menu-dropdown').forEach(el => el.classList.remove('show'));
};

async function deleteChat(id, e) {
    e.stopPropagation();
    await fetch(`/api/delete_chat/${id}`, { 
        method: 'DELETE' 
    });
    loadChatHistorySidebar();
    resetToNewChat();
}

let chatToRenameId = null;

function renameChat(id, e) {
    e.stopPropagation();
    chatToRenameId = id;

    // Find existing title to pre-fill the input
    const currentTitle = document.querySelector(`.history-item[data-id="${id}"] .text-label`).innerText;
    document.getElementById('renameInput').value = currentTitle;

    document.getElementById('renameModal').classList.add('show');
    document.getElementById('renameInput').focus();
}

function closeRenameModal() {
    document.getElementById('renameModal').classList.remove('show');
    chatToRenameId = null;
}

// Handle the Save button click
document.getElementById('confirmRenameBtn').onclick = async () => {
    const newTitle = document.getElementById('renameInput').value.trim();
    if (newTitle && chatToRenameId) {
        await fetch('/api/rename_chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatToRenameId, title: newTitle })
        });
        loadChatHistorySidebar();

        // If the renamed chat is the one currently open, update the top header too
        if (chatToRenameId === currentChatId) {
            document.getElementById('topTitle').innerText = newTitle;
        }

        closeRenameModal();
    }
};

// Close modal if clicking outside the box
window.addEventListener('click', (e) => {
    const modal = document.getElementById('renameModal');
    if (e.target === modal) closeRenameModal();
});