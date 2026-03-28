// config.js - هذا الملف يحتوي على كل شيء حساس
// احفظه في مجلد منفصل أو اجعله غير متاح للعامة

const firebaseConfig = {
    apiKey: "AIzaSyDXnCq-6YYU8QwVdOzN9d1EfyOTWzqWBvs",
    authDomain: "salahsweetmanage.firebaseapp.com",
    databaseURL: "https://salahsweetmanage-default-rtdb.firebaseio.com",
    projectId: "salahsweetmanage",
    storageBucket: "salahsweetmanage.firebasestorage.app",
    messagingSenderId: "126049780562",
    appId: "1:126049780562:web:147daa036e56273263308b",
    measurementId: "G-E7FLGBQ397"
};

// تهيئة Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// ==========================================
// دالة موحدة لجميع العمليات على قاعدة البيانات
// ==========================================

export const db = {
    // المصادقة
    auth: {
        login: (email, password) => signInWithEmailAndPassword(auth, email, password),
        signup: (email, password) => createUserWithEmailAndPassword(auth, email, password),
        logout: () => signOut(auth),
        onAuthChange: (callback) => onAuthStateChanged(auth, callback),
        get currentUser() { return auth.currentUser; }
    },

    // الأرصدة
    balances: {
        get: () => get(ref(database, 'balances')),
        update: (data) => update(ref(database, 'balances'), data),
        onChange: (callback) => onValue(ref(database, 'balances'), callback)
    },

    // الخزنة
    safe: {
        get: () => get(ref(database, 'safe')),
        set: (data) => set(ref(database, 'safe'), data),
        onChange: (callback) => onValue(ref(database, 'safe'), callback)
    },

    // الإحصائيات
    stats: {
        get: () => get(ref(database, 'stats/today')),
        update: (data) => update(ref(database, 'stats/today'), data)
    },

    // العمليات
    transactions: {
        push: (data) => push(ref(database, 'transactions'), data),
        onChange: (callback) => onValue(ref(database, 'transactions'), callback)
    },

    // آخر عملية (لمنع التكرار)
    lastTransaction: {
        get: () => get(ref(database, 'lastTransaction')),
        set: (data) => set(ref(database, 'lastTransaction'), data)
    }
};

// ==========================================
// دوال مساعدة (Helper Functions)
// ==========================================

export const helpers = {
    // توليد UID فريد
    generateUID: () => Date.now().toString(36).toUpperCase().slice(-6),

    // تنسيق الوقت
    formatTime: (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('ar-SA', { hour12: false, hour: '2-digit', minute: '2-digit' });
    },

    // تنسيق التاريخ
    formatDate: (date) => {
        return date.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    },

    // توحيد النص (لمنع التكرار)
    normalizeText: (text) => text.replace(/ة$/, 'ه').toLowerCase().trim(),

    // التحقق من التكرار
    checkDuplicate: (lastTx, type, name, amount) => {
        const now = Date.now();
        return lastTx && 
               lastTx.type === type && 
               helpers.normalizeText(lastTx.name) === helpers.normalizeText(name) && 
               lastTx.amount == amount && 
               (now - lastTx.time) < 60000;
    }
};

console.log('✅ Config loaded - Firebase initialized');
