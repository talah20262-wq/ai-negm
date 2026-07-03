// تكوين اتصالات النظام المحددة
const FIREBASE_DB_URL = "https://ai-negm-default-rtdb.firebaseio.com";
const CLOUDFLARE_WORKER_URL = "https://lively-night-9b33.talah2026-2.workers.dev";

// متغيرات عامة لحالة النظام المحلية
let databaseState = {
    users: {},
    chats: {},
    messages: {},
    site_settings: { maintenance: false },
    logs: []
};

let currentUser = {
    uid: "demo_user_101",
    name: "مستخدم تجريبي",
    email: "user@negm.ai",
    photo: "",
    isAdmin: false
};

let currentUploadedImageBase64 = null;

// --- 1. إعداد نظام التخزين المؤقت للصور (IndexedDB) ---
const DB_NAME = "NegmImageCache";
const DB_VERSION = 1;
let localIndexedDB;

const requestDB = indexedDB.open(DB_NAME, DB_VERSION);
requestDB.onupgradeneeded = (e) => {
    localIndexedDB = e.target.result;
    if (!localIndexedDB.objectStoreNames.contains("temp_images")) {
        localIndexedDB.createObjectStore("temp_images", { keyPath: "id" });
    }
};
requestDB.onsuccess = (e) => { localIndexedDB = e.target.result; };

function saveImageToIndexedDB(id, base64Data) {
    if (!localIndexedDB) return;
    const tx = localIndexedDB.transaction("temp_images", "readwrite");
    const store = tx.objectStore("temp_images");
    store.put({ id: id, data: base64Data, timestamp: Date.now() });
}

// --- 2. محرك الشات والمعادلة السرية لدخول المالك ---
const chatInput = document.getElementById("chat-user-textarea");
const sendChatBtn = document.getElementById("send-chat-message-btn");
const fileInput = document.getElementById("file-upload-input");

if (chatInput) {
    sendChatBtn.addEventListener("click", processUserMessage);
    chatInput.addEventListener("keypress", (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            processUserMessage();
        }
    });
}

if (fileInput) {
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                currentUploadedImageBase64 = event.target.result;
                document.getElementById("temp-uploaded-img").src = currentUploadedImageBase64;
                document.getElementById("image-preview-zone").style.display = "block";
                // حفظ فوري ومؤقت على الجهاز في IndexedDB
                saveImageToIndexedDB("last_upload", currentUploadedImageBase64);
            };
            reader.readAsDataURL(file);
        }
    });
}

function clearUploadedImage() {
    currentUploadedImageBase64 = null;
    document.getElementById("image-preview-zone").style.display = "none";
    if(fileInput) fileInput.value = "";
}

async function processUserMessage() {
    const text = chatInput.value.trim();
    if (!text && !currentUploadedImageBase64) return;

    // 🔥 الشفرة السرية المطلوبة: إذا كتب المستخدم 2009 يتم تحويله فوراً للمالك ويفتح لوحة التحكم
    if (text === "2009") {
        currentUser.isAdmin = true;
        chatInput.value = "";
        alert("💥 تم التحقق من هوية المالك بنجاح! جاري الانتقال للوحة التحكم الخارقة...");
        window.location.href = "admin.html";
        return;
    }

    appendMessageToUI("user", text, currentUploadedImageBase64);
    chatInput.value = "";
    clearUploadedImage();

    // إرسال الطلب إلى Cloudflare Worker لتمرير البيانات للـ AI
    try {
        const activeModel = document.getElementById("model-select").value;
        const response = await fetch(CLOUDFLARE_WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: activeModel,
                messages: [{ role: "user", content: text }],
                max_tokens: 500
            })
        });

        const data = await response.json();
        const aiResponseText = data.choices[0].message.content;
        appendMessageToUI("assistant", aiResponseText);
        
        // مزامنة العدادات المسجلة وحفظها في قاعدة بيانات Firebase
        syncDataWithFirebase();
    } catch (err) {
        appendMessageToUI("assistant", "خطأ: لم أتمكن من الاتصال بالـ Worker. تأكد من تفعيل السيرفر ومتغير البيئة الخاص بـ OpenRouter.");
    }
}

function appendMessageToUI(role, text, image = null) {
    const area = document.getElementById("messages-display-area");
    if (!area) return;
    const msgDiv = document.createElement("div");
    msgDiv.className = `message-bubble ${role === 'user' ? 'user-msg' : 'ai-msg'} glass-panel`;
    
    let contentHtml = `<p>${text}</p>`;
    if (image) {
        contentHtml += `<img src="${image}" class="chat-attached-image" style="max-width:200px; border-radius:8px; margin-top:10px; display:block;">`;
    }
    
    msgDiv.innerHTML = contentHtml;
    area.appendChild(msgDiv);
    area.scrollTop = area.scrollHeight;
}

// --- 3. وظائف لوحة التحكم والمدير (Admin Panels) ---
function switchAdminTab(tabId) {
    document.querySelectorAll(".admin-section").forEach(sec => sec.classList.remove("active"));
    const targetSection = document.getElementById(`${tabId}-tab`);
    if(targetSection) targetSection.classList.add("active");
    
    document.querySelectorAll(".sidebar-menu .menu-item").forEach(item => item.classList.remove("active"));
    event.currentTarget.classList.add("active");
}

// محاكاة مزامنة التحليلات المباشرة (Real-time Simulation)
function generateMockStatsData() {
    document.getElementById("stat-users").innerText = "1,248";
    document.getElementById("stat-chats").innerText = "5,812";
    document.getElementById("stat-ai-msg").innerText = "42,910";
    document.getElementById("stat-today-msg").innerText = "843";
    document.getElementById("stat-new-users").innerText = "+24";
    document.getElementById("stat-online").innerText = "18";
    document.getElementById("stat-banned").innerText = "3";
    document.getElementById("stat-or-requests").innerText = "16,402";
    
    // بناء جدول المستخدمين مع البيانات الكاملة المطلوبة
    const tbody = document.getElementById("users-table-body");
    if(tbody) {
        tbody.innerHTML = `
            <tr>
                <td><img src="https://via.placeholder.com/35" style="border-radius:50%"></td>
                <td><b>محمد النجم</b><br><small style="color:var(--neon-blue)">uid_owner_negm</small></td>
                <td>mohamed@negm.com<br>🇪🇬 مصر</td>
                <td>Windows 11<br>192.168.1.1</td>
                <td>2026-04-01<br>الآن</td>
                <td>280 محادثة<br>1,450 رسالة</td>
                <td><span style="color:var(--neon-green)">نشط (VIP)</span></td>
                <td>
                    <button class="btn btn-neon-blue" style="padding:4px 8px; font-size:11px;">VIP</button>
                    <button class="btn btn-neon-red" style="padding:4px 8px; font-size:11px;">حظر</button>
                </td>
            </tr>
        `;
    }
}

// تفعيل الرسوم البيانية عند تحميل لوحة التحكم
window.onload = () => {
    generateMockStatsData();
    
    const ctx1 = document.getElementById('hourlyChart');
    if (ctx1) {
        new Chart(ctx1, {
            type: 'line',
            data: {
                labels: ['1 AM', '4 AM', '8 AM', '12 PM', '4 PM', '8 PM'],
                datasets: [{
                    label: 'الرسائل لكل ساعة',
                    data: [12, 19, 3, 5, 2, 3],
                    borderColor: '#00d2ff',
                    backgroundColor: 'rgba(0, 210, 255, 0.1)',
                    fill: true
                }]
            },
            options: { responsive: true }
        });
    }

    const ctx2 = document.getElementById('modelsChart');
    if (ctx2) {
        new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: ['Gemini', 'GPT-4o', 'Claude', 'DeepSeek'],
                datasets: [{
                    label: 'أكثر النماذج استخداماً',
                    data: [65, 25, 40, 55],
                    backgroundColor: ['#00ff87', '#00d2ff', '#9d4edd', '#ff007f']
                }]
            },
            options: { responsive: true }
        });
    }
};

// عمليات النسخ الاحتياطي وتصدير البيانات
function exportFullDatabase() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(databaseState));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `NEGM_AI_DB_Backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function toggleMaintenanceMode(isTrue) {
    console.log("وضع الصيانة تغير إلى:", isTrue);
    // إرسال الإشعار والتحديث لـ Firebase
    fetch(`${FIREBASE_DB_URL}/site_settings/maintenance.json`, {
        method: "PUT",
        body: JSON.stringify(isTrue)
    });
}

function syncDataWithFirebase() {
    // كود مزامنة البيانات وتحديث الحقول المباشرة داخل الـ Realtime Database
    fetch(`${FIREBASE_DB_URL}/logs.json`, {
        method: "POST",
        body: JSON.stringify({
            action: "user_sent_message",
            time: new Date().toISOString(),
            uid: currentUser.uid
        })
    });
}
