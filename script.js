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

// =======================================================
// 📈 4. دوال التحديث والحساب الرئيسي
// -------------------------------------------------------

/**
 * الدالة الرئيسية لتحديث جميع الحسابات وعناصر الواجهة المرتبطة بها.
 */
function updateMainCalculations() {
    // 1. حساب المبيعات الكلية
    todayData.totalSales = todayData.cash + todayData.bank + todayData.newDebtTotal;

    // 2. الحسابات النهائية
    const commission = calculateCommission(todayData.totalSales);
    const netDue = todayData.totalSales + todayData.totalRepaid - commission; 

    // 3. تحديث العرض في قسم 1
    document.getElementById('total-sales-display').textContent = formatNumber(todayData.totalSales);

    // 4. تحديث العرض في قسم 4 (الملخص)
    document.getElementById('summary-total-sales').textContent = formatNumber(todayData.totalSales);
    document.getElementById('summary-total-repaid').textContent = formatNumber(todayData.totalRepaid);
    document.getElementById('summary-commission').textContent = formatNumber(commission);
    document.getElementById('summary-net-due').textContent = formatNumber(netDue);
    
    // 5. تحديث المؤشرات والقوائم
    updateDebtMatchIndicator();
    renderNewDebtList();
    renderActiveDebtorsList();
    updateDebtorsDatalist();
    
    // 6. حفظ بيانات اليوم
    saveTodayData();
}

/**
 * يحدد حالة تطابق تفصيل الديون الجديدة مع إجماليها.
 */
function updateDebtMatchIndicator() {
    const totalRequired = todayData.newDebtTotal;
    const totalDetailed = todayData.totalNewDetailedDebt;
    const indicator = document.getElementById('match-indicator');
    const endDayBtn = document.getElementById('end-day-btn');
    const requiredDebtDisplay = document.getElementById('required-debt-display');
    const excessWarning = document.getElementById('debt-excess-warning');
    
    requiredDebtDisplay.textContent = formatNumber(totalRequired);
    
    const difference = totalRequired - totalDetailed; // موجب: نقص، سالب: زيادة

    endDayBtn.classList.remove('bg-blue-500', 'bg-red-400', 'hover:bg-blue-600', 'hover:bg-red-600');
    indicator.classList.remove('text-green-700', 'text-red-700', 'text-sm', 'text-base');

    // حالة المطابقة التامة (الاختلاف صفر)
    if (difference === 0) {
        indicator.innerHTML = '✅ **مطابق**';
        indicator.classList.add('text-green-700', 'text-base');
        endDayBtn.disabled = false;
        endDayBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        excessWarning.classList.add('hidden');

    // حالة الزيادة (التفصيل أكبر من الإجمالي المعلن)
    } else if (totalDetailed > totalRequired) {
        // يسمح بالتجاوز في الإدخال، لكن يعطل الإنهاء
        indicator.innerHTML = `⚠️ **زيادة في التفصيل** (${formatNumber(Math.abs(difference))})`;
        indicator.classList.add('text-red-700', 'text-sm');
        endDayBtn.disabled = true;
        endDayBtn.classList.add('bg-red-400', 'hover:bg-red-600');
        
        excessWarning.textContent = `⚠️ مجموع الديون المفصلة أكبر من الإجمالي بفارق: ${formatNumber(Math.abs(difference))}`;
        excessWarning.classList.remove('hidden');

    // حالة النقص (التفصيل أقل من الإجمالي المعلن)
    } else { // difference > 0
        indicator.innerHTML = `⚠️ **غير مطابق** (ناقص: ${formatNumber(difference)})`;
        indicator.classList.add('text-red-700', 'text-sm');
        endDayBtn.disabled = true;
        endDayBtn.classList.add('bg-red-400', 'hover:bg-red-600');
        
        excessWarning.classList.add('hidden');
    }
}

// =======================================================
// 5. دوال الإدخال والتفصيل
// -------------------------------------------------------

/**
 * يعالج إدخالات المبيعات (كاش، بنك، ديون جديدة).
 * @param {Event} e - حدث الإدخال.
 */
function handleSalesInput(e) {
    const inputElement = e.target;
    const cleanValue = cleanNumber(inputElement.value);

    // التصفير اللحظي (تحسين UX): يتم تصفير الحقل إذا كانت القيمة النظيفة صفراً
    if (cleanValue === 0) {
        inputElement.value = ''; 
    } else {
        inputElement.value = formatNumber(cleanValue);
    }

    if (inputElement.id === 'input-cash') {
        todayData.cash = cleanValue;
    } else if (inputElement.id === 'input-bank') {
        todayData.bank = cleanValue;
    } else if (inputElement.id === 'input-new-debt-total') {
        todayData.newDebtTotal = cleanValue;
    }
    
    updateMainCalculations();
}

/**
 * يضيف ديناً جديداً مفصلاً.
 */
function handleAddNewDebt() {
    const nameInput = document.getElementById('debtor-name');
    const amountInput = document.getElementById('debtor-amount');
    
    const name = nameInput.value.trim();
    const amount = cleanNumber(amountInput.value);

    if (!name || name.split(/\s+/).length < 2) {
        showToast("الرجاء إدخال **الاسم ثنائياً** على الأقل (مثال: محمد علي) 📝", 'error');
        return;
    }
    
    if (amount <= 0) {
        showToast("الرجاء إدخال قيمة صحيحة للمبلغ.", 'error');
        return;
    }
    
    // تمكين الإدخال المرن: لا يوجد شرط منع للتجاوز هنا.

    todayData.totalNewDetailedDebt += amount;

    if (todayData.newDebts[name]) {
        todayData.newDebts[name] += amount;
    } else {
        todayData.newDebts[name] = amount;
    }

    nameInput.value = '';
    amountInput.value = '';

    updateMainCalculations(); 
    showToast(`تم إضافة ${formatNumber(amount)} لـ **${name}** بنجاح ✅`, 'success');
}

/**
 * تحديث قائمة الأسماء المقترحة (datalist) للمدينين (الجدد والنشطين).
 */
function updateDebtorsDatalist() {
    const datalist = document.getElementById('debtors-names-list');
    datalist.innerHTML = '';
    
    const allDebtors = new Set([
        ...Object.keys(todayData.newDebts),
        ...Object.keys(activeDebtors) 
    ]);
    
    allDebtors.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        datalist.appendChild(option);
    });
}

/**
 * يعرض قائمة الديون الجديدة المفصلة.
 */
function renderNewDebtList() {
    const listContainer = document.getElementById('new-debt-list');
    listContainer.innerHTML = ''; 
    
    const names = Object.keys(todayData.newDebts);
    if (names.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-500 p-4">لا توجد ديون مفصلة بعد.</p>';
        return;
    }

    names.forEach(name => {
        const amount = todayData.newDebts[name];
        if (amount <= 0) return; 
        
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center p-3 rounded-lg bg-white card hover:bg-gray-50 transition';
        item.innerHTML = `
            <span class="font-medium text-gray-800">${name}</span>
            <div class="flex items-center">
                <span class="text-lg font-bold text-red-600 ml-4">${formatNumber(amount)}</span>
                <button data-name="${name}" class="delete-debt-btn text-red-500 hover:text-red-700 transition mr-1">
                    ❌
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

/**
 * يعالج حدث حذف دين جديد مفصل.
 * @param {Event} e - حدث النقر.
 */
function handleDeleteDebt(e) {
    if (e.target.classList.contains('delete-debt-btn')) {
        const name = e.target.getAttribute('data-name');
        const amount = todayData.newDebts[name];
        
        if (confirm(`هل أنت متأكد من حذف تفصيل دين العميل ${name} بقيمة ${formatNumber(amount)}؟`)) {
            todayData.totalNewDetailedDebt -= amount;
            delete todayData.newDebts[name];
            
            updateMainCalculations();
            showToast(`تم حذف تفصيل دين ${name} 🗑️`, 'info');
        }
    }
}

// =======================================================
// 💳 6. دوال السداد
// -------------------------------------------------------

/**
 * يعرض قائمة بجميع المدينين النشطين والديون الجديدة غير المسددة في قسم السداد.
 */
function renderActiveDebtorsList() {
    const listContainer = document.getElementById('active-debtors-list');
    listContainer.innerHTML = '';
    
    // دمج الديون النشطة والديون الجديدة (للعرض فقط)
    const combinedDebts = { ...activeDebtors };
    Object.entries(todayData.newDebts).forEach(([name, amount]) => {
        combinedDebts[name] = (combinedDebts[name] || 0) + amount;
    });
    
    const names = Object.keys(combinedDebts).filter(name => combinedDebts[name] > 0);

    if (names.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-500 p-4">لا يوجد عملاء مدينون حاليًا.</p>';
        return;
    }

    names.forEach(name => {
        const debt = combinedDebts[name];

        const item = document.createElement('div');
        item.className = 'p-4 rounded-xl card bg-white flex flex-col md:flex-row justify-between items-center';
        item.innerHTML = `
            <div class="mb-2 md:mb-0">
                <span class="text-lg font-bold text-gray-800">${name}</span>
                <p class="text-sm text-gray-600">الدين المتبقي: <span class="font-bold text-red-500">${formatNumber(debt)}</span></p>
            </div>
            <div class="flex items-center w-full md:w-auto">
                <input type="tel" data-debtor="${name}" inputmode="numeric" placeholder="مبلغ السداد..." class="repay-input w-2/3 md:w-40 p-2 border rounded-lg ml-2 focus:ring-blue-500">
                <button data-debtor="${name}" class="repay-btn w-1/3 md:w-20 bg-blue-500 text-white p-2 rounded-lg font-semibold hover:bg-blue-600 transition">سداد</button>
            </div>
        `;
        listContainer.appendChild(item);
        
        // ربط تنسيق المبلغ اللحظي لحقل السداد
        const inputElement = item.querySelector('.repay-input');
        inputElement.addEventListener('input', (e) => {
             const cleanValue = cleanNumber(e.target.value);
             // التصفير اللحظي (تحسين UX)
             if (cleanValue === 0) {
                e.target.value = ''; 
            } else {
                e.target.value = formatNumber(cleanValue);
            }
        });
    });
}

/**
 * يعالج عملية السداد من قبل العميل.
 * @param {Event} e - حدث النقر على زر السداد.
 */
function handleRepayment(e) {
    if (e.target.classList.contains('repay-btn')) {
        const name = e.target.getAttribute('data-debtor');
        const input = document.querySelector(`.repay-input[data-debtor="${name}"]`);
        const repayAmount = cleanNumber(input.value);
        
        const debtFromNew = todayData.newDebts[name] || 0;
        const debtFromActive = activeDebtors[name] || 0;
        const currentTotalDebt = debtFromNew + debtFromActive;

        if (repayAmount <= 0) {
            showToast("الرجاء إدخال مبلغ سداد صحيح.", 'error');
            return;
        }

        if (currentTotalDebt === 0) {
            showToast(`العميل **${name}** لا يدين بأي مبلغ حالياً. 🚫`, 'error');
            input.value = ''; 
            return;
        } else if (repayAmount > currentTotalDebt) {
            showToast(`تحذير: المبلغ المدخل (${formatNumber(repayAmount)}) أكبر من الدين المستحق! سيتم تصفير الدين بالكامل.`, 'error');
        }
            
        todayData.totalRepaid += repayAmount;

        let remainingRepay = repayAmount;
        let totalRepaidFromThisDebt = 0;

        // الخصم من الديون الجديدة أولاً
        if (debtFromNew > 0 && remainingRepay > 0) {
            const debtToRepayFromNew = Math.min(remainingRepay, debtFromNew);
            todayData.newDebts[name] -= debtToRepayFromNew;
            todayData.totalNewDetailedDebt -= debtToRepayFromNew; // تحديث الإجمالي المفصل
            remainingRepay -= debtToRepayFromNew;
            totalRepaidFromThisDebt += debtToRepayFromNew;
            
            if (todayData.newDebts[name] <= 0) {
                delete todayData.newDebts[name];
            }
        }

        // الخصم من الديون القديمة ثانياً
        if (debtFromActive > 0 && remainingRepay > 0) {
            const debtToRepayFromActive = Math.min(remainingRepay, debtFromActive);
            activeDebtors[name] -= debtToRepayFromActive;
            remainingRepay -= debtToRepayFromActive;
            totalRepaidFromThisDebt += debtToRepayFromActive;

            if (activeDebtors[name] <= 0) {
                delete activeDebtors[name];
            }
        }
        
        // رسالة التأكيد
        const remainingDebt = (todayData.newDebts[name] || 0) + (activeDebtors[name] || 0);
        if (remainingDebt <= 0) {
            showToast(`تم تصفير دين **${name}** بالكامل! 🎉`, 'success');
        } else {
             showToast(`تم سداد ${formatNumber(totalRepaidFromThisDebt)}. المتبقي لـ **${name}**: ${formatNumber(remainingDebt)} 💳`, 'success');
        }

        saveActiveDebtors();
        updateMainCalculations(); 
        input.value = ''; 
    }
}

// =======================================================
// 🛑 7. دوال إنهاء اليوم
// -------------------------------------------------------

/**
 * يعالج منطق إنهاء اليوم.
 */
function handleEndDay() {
    const endDayBtn = document.getElementById('end-day-btn');
    
    if (endDayBtn.disabled) {
        const totalRequired = todayData.newDebtTotal;
        const totalDetailed = todayData.totalNewDetailedDebt;
        const difference = totalDetailed - totalRequired; 
        let errorMessage = `⚠️ لا يمكن إنهاء اليوم: هناك بيانات غير مكتملة أو غير مطابقة.`;

        if (difference > 0) {
             errorMessage = `⚠️ لا يمكن إنهاء اليوم: مجموع الديون المفصلة (${formatNumber(totalDetailed)}) **أكبر** من إجمالي الديون الجديدة (${formatNumber(totalRequired)}) بفارق ${formatNumber(difference)}. يجب تعديل الإجمالي المعلن.`;
        } else if (difference < 0) {
             errorMessage = `⚠️ لا يمكن إنهاء اليوم: لا يوجد تطابق في تفصيل الديون. يجب تفصيل المبلغ المتبقي: ${formatNumber(Math.abs(difference))}.`;
        }
        
        showToast(errorMessage, 'error');
        return; 
    }
    
    // 1. دمج الديون الجديدة مع الديون النشطة
    Object.entries(todayData.newDebts).forEach(([name, amount]) => {
        if (amount > 0) {
            activeDebtors[name] = (activeDebtors[name] || 0) + amount;
        }
    });

    // 2. تنظيف قائمة المدينين النشطين
    Object.keys(activeDebtors).forEach(name => {
        if (activeDebtors[name] <= 0) {
            delete activeDebtors[name];
        }
    });

    saveActiveDebtors(); 
    showFinalReport();
}

/**
 * يعرض النافذة المنبثقة للتقرير النهائي.
 */
function showFinalReport() {
    const totalSales = todayData.totalSales;
    const totalRepaid = todayData.totalRepaid;
    const commission = calculateCommission(totalSales);
    const netDue = totalSales + totalRepaid - commission;
    const newDebtorsCount = Object.keys(todayData.newDebts).length;
    
    const repaidCount = todayData.totalRepaid > 0 ? 'نعم' : 'لا'; 

    const reportContent = `
        <p><strong>إجمالي المبيعات الكلي:</strong> ${formatNumber(totalSales)}</p>
        <p><strong>إجمالي السداد المسترد:</strong> ${formatNumber(totalRepaid)}</p>
        <p><strong>العمولة المحسوبة:</strong> ${formatNumber(commission)}</p>
        <p><strong>النسبة النهائية المستحقة:</strong> <span class="text-red-600 font-bold">${formatNumber(netDue)}</span></p>
        <hr class="my-2">
        <p><strong>عدد العملاء الجدد (ديون):</strong> ${newDebtorsCount}</p>
        <p><strong>تم تسجيل عمليات سداد:</strong> ${repaidCount}</p>
    `;

    document.getElementById('final-report-content').innerHTML = reportContent;
    document.getElementById('report-modal').classList.remove('hidden');
}

/**
 * يعيد تهيئة بيانات اليوم لبدء يوم عمل جديد.
 */
function startNewDay() {
    // تصفير بيانات اليوم فقط
    todayData.cash = 0;
    todayData.bank = 0;
    todayData.newDebtTotal = 0;
    todayData.newDebts = {};
    todayData.totalNewDetailedDebt = 0;
    todayData.totalRepaid = 0;

    // حذف بيانات اليوم من التخزين المحلي (نحتفظ بقائمة المدينين النشطين)
    localStorage.removeItem('todayData');

    document.getElementById('report-modal').classList.add('hidden');

    // إعادة تحميل الصفحة
    window.location.reload(); 
}


// =======================================================
// 🌟 8. التهيئة والـ Listeners
// -------------------------------------------------------

function initialize() {
    loadData();

    // تحديث وعرض التاريخ والوقت
    const updateTime = () => {
        const now = new Date();
        // تنسيق الوقت والتاريخ باللغة العربية
        document.getElementById('current-day-name').textContent = now.toLocaleDateString('ar-EG', { weekday: 'long' });
        document.getElementById('current-date').textContent = now.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
        document.getElementById('live-clock').textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    };
    updateTime();
    setInterval(updateTime, 1000); 

    // تهيئة حقول المبيعات بالبيانات المحملة
    document.getElementById('input-cash').value = todayData.cash > 0 ? formatNumber(todayData.cash) : '';
    document.getElementById('input-bank').value = todayData.bank > 0 ? formatNumber(todayData.bank) : '';
    document.getElementById('input-new-debt-total').value = todayData.newDebtTotal > 0 ? formatNumber(todayData.newDebtTotal) : '';
    
    // ربط الـ Listeners للإدخال (قسم 1)
    document.getElementById('input-cash').addEventListener('input', handleSalesInput);
    document.getElementById('input-bank').addEventListener('input', handleSalesInput);
    document.getElementById('input-new-debt-total').addEventListener('input', handleSalesInput);
    
    // ربط تنسيق المبلغ لحقل الدين الجديد
    document.getElementById('debtor-amount').addEventListener('input', (e) => {
        const cleanValue = cleanNumber(e.target.value);
        // التصفير اللحظي (تحسين UX)
        if (cleanValue === 0) {
            e.target.value = ''; 
        } else {
            e.target.value = formatNumber(cleanValue);
        }
    });

    // ربط الـ Listeners لقسم تفصيل الديون (قسم 2)
    document.getElementById('add-debt-btn').addEventListener('click', handleAddNewDebt);
    document.getElementById('new-debt-list').addEventListener('click', handleDeleteDebt);

    // ربط الـ Listeners لقسم السداد (قسم 3)
    document.getElementById('active-debtors-list').addEventListener('click', handleRepayment);

    // ربط الـ Listeners لإنهاء اليوم (قسم 4)
    document.getElementById('end-day-btn').addEventListener('click', handleEndDay);
    document.getElementById('start-new-day-btn').addEventListener('click', startNewDay);
    
    // ربط الـ Listeners للتبويبات
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const tabId = e.target.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('bg-blue-500', 'text-white');
                btn.classList.add('text-gray-700', 'hover:bg-gray-200');
            });
            
            document.getElementById(tabId).classList.add('active');
            e.target.classList.add('bg-blue-500', 'text-white');
            e.target.classList.remove('text-gray-700', 'hover:bg-gray-200');
            
            // تحديث قوائم العرض عند التبديل
            updateMainCalculations(); 
        });
    });

    // الاستدعاء الأولي للوظائف
    updateMainCalculations(); 
}

// البدء
initialize();