// =======================================================
// script.js - منطق نظام إدارة المبيعات (النسخة المحسّنة والمرنة)
// =======================================================

// 🧠 1. كائن التخزين والتحميل الأولي والثوابت
// -------------------------------------------------------

const COMMISSION_CONSTS = {
    MIN_DAILY: 15000,
    UNIT_SALES: 8000,
    COMMISSION_PER_UNIT: 600,
};

/**
 * @typedef {Object} DayData
 * @property {number} cash - إجمالي مبيعات الكاش.
 * @property {number} bank - إجمالي مبيعات البنكك.
 * @property {number} newDebtTotal - الإجمالي المعلن للديون الجديدة (في القسم 1).
 * @property {number} totalSales - المبيعات الكلية.
 * @property {Object.<string, number>} newDebts - تفصيل الديون الجديدة لليوم.
 * @property {number} totalNewDetailedDebt - مجموع الديون المفصلة.
 * @property {number} totalRepaid - إجمالي السدادات المستردة.
 */
let todayData = {
    cash: 0,
    bank: 0,
    newDebtTotal: 0,
    totalSales: 0,
    newDebts: {}, 
    totalNewDetailedDebt: 0, 
    totalRepaid: 0, 
};

// كائن مستقل لتخزين الديون المستمرة (العملاء المدينون عبر الأيام)
let activeDebtors = {}; 

// =======================================================
// 🧮 2. الدوال المساعدة للحساب والتنسيق
// -------------------------------------------------------

/**
 * يعرض رسالة توست للمستخدم.
 * @param {string} message - الرسالة المراد عرضها.
 * @param {'info'|'success'|'error'} [type='info'] - نوع الرسالة لتحديد اللون.
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    let bgColor = 'bg-blue-500';
    if (type === 'success') bgColor = 'bg-green-500';
    if (type === 'error') bgColor = 'bg-red-500';

    toast.className = `${bgColor} text-white p-3 rounded-lg shadow-xl card transition-all duration-300 transform translate-x-full opacity-0`;
    toast.innerHTML = message; 

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    }, 10); 

    setTimeout(() => {
        toast.classList.remove('translate-x-0', 'opacity-100');
        toast.classList.add('translate-x-full', 'opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

/**
 * ينظف ويحول قيمة الإدخال إلى رقم عشري.
 * @param {string} value - القيمة النصية من حقل الإدخال.
 * @returns {number} - القيمة الرقمية النظيفة.
 */
function cleanNumber(value) {
    if (typeof value !== 'string') return 0;
    const cleaned = value.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
}

/**
 * ينسق الرقم مع فاصل الآلاف.
 * @param {number} number - الرقم المراد تنسيقه.
 * @returns {string} - الرقم المنسق كنص.
 */
function formatNumber(number) {
    return new Intl.NumberFormat('en-US').format(number);
}

/**
 * يحسب عمولة المبيعات بناءً على الثوابت.
 * @param {number} salesTotal - إجمالي المبيعات.
 * @returns {number} - قيمة العمولة المحسوبة.
 */
function calculateCommission(salesTotal) {
    let commission = Math.floor(salesTotal / COMMISSION_CONSTS.UNIT_SALES) * COMMISSION_CONSTS.COMMISSION_PER_UNIT;

    if (commission < COMMISSION_CONSTS.MIN_DAILY) {
        commission = COMMISSION_CONSTS.MIN_DAILY;
    }
    return commission;
}

// =======================================================
// 🔄 3. دوال التخزين (Local Storage)
// -------------------------------------------------------

function loadData() {
    const savedTodayData = localStorage.getItem('todayData');
    if (savedTodayData) {
        // نستخدم Object.assign لدمج البيانات المحفوظة مع الهيكل الافتراضي
        Object.assign(todayData, JSON.parse(savedTodayData));
    }

    const savedActiveDebtors = localStorage.getItem('activeDebtors');
    if (savedActiveDebtors) {
        activeDebtors = JSON.parse(savedActiveDebtors);
    }
}

function saveTodayData() {
    localStorage.setItem('todayData', JSON.stringify(todayData));
}

function saveActiveDebtors() {
    localStorage.setItem('activeDebtors', JSON.stringify(activeDebtors));
}

// ======
