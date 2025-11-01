// ملاحظة: تهيئة Firebase (const app, db, auth) تم تعريفها في index.html،
// لذلك نستخدم المتغيرات المعرفة هناك مباشرة.

// تحديد مراجع المجموعات الأساسية
const ACTIVE_DEBTORS_COLLECTION = db.collection('activeDebtors');
const DAILY_REPORTS_COLLECTION = db.collection('dailyReports');
const TODAY_DATA_DOC = ACTIVE_DEBTORS_COLLECTION.doc('currentDay'); 
const DEBTORS_LIST_DOC = ACTIVE_DEBTORS_COLLECTION.doc('list'); 

let todayData = {
    cash: 0,
    bank: 0,
    newDebtTotal: 0,
    totalSales: 0,
    totalRepaid: 0,
    newDebts: {},
};

let activeDebtors = {}; // قائمة المدينين النشطين (الذين لم يسددوا)

// =======================================================
// 🔑 0. منطق التحكم في الصلاحيات (يتم استدعاؤه في index.html)
// =======================================================
// وظيفة checkAuthenticationAndRole() موجودة الآن في وسم <script> داخل index.html
// للتأكد من أنها أول ما يتم تنفيذه بعد تحميل Firebase SDKs.

// =======================================================
// 🧮 1. الدوال المساعدة (Formatting and Commission)
// =======================================================

function formatNumber(number) {
    if (typeof number !== 'number') return '0';
    return new Intl.NumberFormat('en-US').format(Math.round(number));
}

function calculateCommission(sales) {
    // نسبة العمولة الافتراضية: 5%
    return sales * 0.05;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    let bgColor = 'bg-blue-500';
    if (type === 'success') bgColor = 'bg-green-500';
    if (type === 'error') bgColor = 'bg-red-500';

    toast.className = `${bgColor} text-white p-3 rounded-lg shadow-xl transition-all duration-300 transform translate-x-full opacity-0`;
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

// =======================================================
// 📅 2. تحديث التاريخ والوقت
// =======================================================

function updateDateTime() {
    const now = new Date();
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const dayOptions = { weekday: 'long' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };

    const dateStr = now.toLocaleDateString('ar-EG', dateOptions);
    const dayStr = now.toLocaleDateString('ar-EG', dayOptions);
    const timeStr = now.toLocaleTimeString('ar-EG', timeOptions);

    document.getElementById('current-day-name').textContent = dayStr;
    document.getElementById('current-date').textContent = dateStr;
    document.getElementById('live-clock').textContent = timeStr;
}

setInterval(updateDateTime, 1000);
updateDateTime(); // التشغيل الفوري

// =======================================================
// ⬆️ 3. وظائف جلب وحفظ البيانات (Firebase)
// =======================================================

async function loadData() {
    try {
        const todayDoc = await TODAY_DATA_DOC.get();
        if (todayDoc.exists) {
            todayData = todayDoc.data();
        } else {
            // تهيئة بيانات اليوم إذا لم تكن موجودة
            await TODAY_DATA_DOC.set(todayData);
        }

        const debtorsDoc = await DEBTORS_LIST_DOC.get();
        if (debtorsDoc.exists) {
            activeDebtors = debtorsDoc.data();
        } else {
            await DEBTORS_LIST_DOC.set({}); // تهيئة قائمة المدينين
        }
        
        updateMainCalculations();
        updateInputsFromData();
        renderActiveDebtors();

    } catch (error) {
        console.error("Error loading data:", error);
        showToast("فشل في تحميل البيانات الأولية ❌", 'error');
    }
}

async function updateFirestoreTodayData() {
    try {
        // تحديث بيانات اليوم الحالية
        await TODAY_DATA_DOC.set(todayData);
        
        // تحديث قائمة المدينين النشطين
        await DEBTORS_LIST_DOC.set(activeDebtors);
    } catch (error) {
        console.error("Error updating Firestore:", error);
        showToast("فشل في حفظ البيانات على السحابة ❌", 'error');
    }
}

// =======================================================
// 🔄 4. وظائف تحديث الواجهة (UI Updates)
// =======================================================

function updateInputsFromData() {
    // تحديث علامة تبويب المبيعات
    document.getElementById('input-cash').value = todayData.cash || '';
    document.getElementById('input-bank').value = todayData.bank || '';
    document.getElementById('input-new-debt-total').value = todayData.newDebtTotal || '';

    // تحديث قائمة الديون الجديدة
    const debtListContainer = document.getElementById('new-debt-list');
    const newDebtsTotal = Object.values(todayData.newDebts).reduce((acc, curr) => acc + curr, 0);

    debtListContainer.innerHTML = '';
    if (Object.keys(todayData.newDebts).length === 0) {
        debtListContainer.innerHTML = '<p class="text-center text-gray-500">لا توجد ديون مفصلة بعد.</p>';
    } else {
        for (const [name, amount] of Object.entries(todayData.newDebts)) {
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center p-3 bg-white rounded-lg border shadow-sm';
            item.innerHTML = `
                <span class="font-semibold text-gray-800">${name}</span>
                <div class="flex items-center">
                    <span class="font-mono text-red-600 ml-4">${formatNumber(amount)}</span>
                    <button data-name="${name}" class="remove-debt-btn text-red-400 hover:text-red-600 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            `;
            debtListContainer.appendChild(item);
        }
    }
    
    // ربط حدث إزالة الدين الجديد
    document.querySelectorAll('.remove-debt-btn').forEach(button => {
        button.addEventListener('click', handleRemoveNewDebt);
    });
    
    // تحديث مؤشر مطابقة الديون
    const requiredDebt = todayData.newDebtTotal;
    const matchIndicator = document.getElementById('match-indicator');
    document.getElementById('required-debt-display').textContent = formatNumber(requiredDebt);

    if (requiredDebt === 0 && newDebtsTotal === 0) {
        matchIndicator.textContent = 'مطابق تماماً';
        matchIndicator.className = 'text-sm font-normal ml-4 text-green-600';
        document.getElementById('debt-excess-warning').classList.add('hidden');
    } else if (requiredDebt === newDebtsTotal) {
        matchIndicator.textContent = '✅ مطابق تماماً';
        matchIndicator.className = 'text-sm font-normal ml-4 text-green-600';
        document.getElementById('debt-excess-warning').classList.add('hidden');
    } else {
        const diff = newDebtsTotal - requiredDebt;
        matchIndicator.textContent = `⚠️ غير مطابق (الفرق: ${formatNumber(diff)})`;
        matchIndicator.className = 'text-sm font-normal ml-4 text-red-600';
        document.getElementById('debt-excess-warning').classList.toggle('hidden', diff <= 0);
    }
}

function updateMainCalculations() {
    const totalSales = todayData.cash + todayData.bank + todayData.newDebtTotal;
    todayData.totalSales = totalSales;

    const commission = calculateCommission(totalSales);
    const netDue = totalSales + todayData.totalRepaid - commission;
    
    // تحديث الواجهة
    document.getElementById('total-sales-display').textContent = formatNumber(totalSales);

    // تحديث ملخص إنهاء اليوم
    document.getElementById('summary-total-sales').textContent = formatNumber(totalSales);
    document.getElementById('summary-total-repaid').textContent = formatNumber(todayData.totalRepaid);
    document.getElementById('summary-commission').textContent = formatNumber(commission);
    document.getElementById('summary-net-due').textContent = formatNumber(netDue);

    // تفعيل زر إنهاء اليوم فقط إذا كان هناك مبيعات وكان تفصيل الديون مطابقاً
    const newDebtsTotal = Object.values(todayData.newDebts).reduce((acc, curr) => acc + curr, 0);
    const isDebtMatched = todayData.newDebtTotal === newDebtsTotal;
    const canEndDay = totalSales > 0 && isDebtMatched;

    document.getElementById('end-day-btn').disabled = !canEndDay;
    document.getElementById('end-day-btn').textContent = canEndDay ? 'إنهاء اليوم وتسجيل التقرير ✅' : 'يجب مطابقة الديون والمبيعات أولاً 🛑';

    updateFirestoreTodayData();
}

function renderActiveDebtors() {
    const listContainer = document.getElementById('active-debtors-list');
    listContainer.innerHTML = '';
    const debtorsKeys = Object.keys(activeDebtors).filter(name => activeDebtors[name] > 0);

    if (debtorsKeys.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-500">لا يوجد مدينون حاليون لسداد ديونهم.</p>';
        return;
    }

    debtorsKeys.forEach(name => {
        const amount = activeDebtors[name];
        const item = document.createElement('div');
        item.className = 'p-4 rounded-xl card bg-white border-b-2 border-green-400';
        item.innerHTML = `
            <p class="font-bold text-lg text-gray-800 mb-2">👤 ${name}</p>
            <p class="text-sm font-medium text-gray-600">المبلغ المتبقي: <span class="font-mono text-xl text-red-600">${formatNumber(amount)}</span></p>
            <div class="mt-3 flex space-x-2 space-x-reverse">
                <input type="tel" id="repay-${name.replace(/\s/g, '_')}" inputmode="numeric" placeholder="مبلغ السداد..." class="flex-grow p-2 rounded-lg border focus:ring-green-500 card">
                <button data-name="${name}" class="repay-btn bg-green-500 text-white p-2 rounded-lg font-semibold hover:bg-green-600 transition">سداد</button>
            </div>
        `;
        listContainer.appendChild(item);
    });

    // ربط حدث السداد
    document.querySelectorAll('.repay-btn').forEach(button => {
        button.addEventListener('click', handleRepayment);
    });

}

// =======================================================
// 🤝 5. معالجات الأحداث (Event Handlers)
// =======================================================

function handleSalesInput(e) {
    const value = parseFloat(e.target.value) || 0;
    const field = e.target.id.split('-')[1]; // cash, bank, newDebtTotal
    
    // يجب ان تكون القيمة رقم موجب او صفر
    todayData[field] = Math.max(0, value);
    e.target.value = todayData[field] || '';
    
    updateMainCalculations();
    updateInputsFromData(); // لتحديث مؤشر مطابقة الديون
}

function handleAddNewDebt() {
    const nameInput = document.getElementById('debtor-name');
    const amountInput = document.getElementById('debtor-amount');
    
    const name = nameInput.value.trim();
    const amount = parseFloat(amountInput.value) || 0;

    if (!name || amount <= 0) {
        showToast("⚠️ يرجى إدخال اسم صحيح ومبلغ موجب.", 'error');
        return;
    }

    // يجب التأكد من عدم تجاوز إجمالي الديون الجديدة
    const currentNewDebtsTotal = Object.values(todayData.newDebts).reduce((acc, curr) => acc + curr, 0);
    const remainingDebt = todayData.newDebtTotal - currentNewDebtsTotal;

    if (amount > remainingDebt) {
        showToast(`⚠️ المبلغ يتجاوز المتبقي لتفصيل الديون الجديدة (${formatNumber(remainingDebt)}).`, 'error');
        return;
    }

    // إضافة أو تحديث الدين الجديد (في بيانات اليوم فقط)
    todayData.newDebts[name] = (todayData.newDebts[name] || 0) + amount;
    
    nameInput.value = '';
    amountInput.value = '';
    
    updateInputsFromData();
    updateMainCalculations();
}

function handleRemoveNewDebt(e) {
    const name = e.currentTarget.getAttribute('data-name');
    
    if (todayData.newDebts[name]) {
        delete todayData.newDebts[name];
    }
    
    updateInputsFromData();
    updateMainCalculations();
}

async function handleRepayment(e) {
    const name = e.currentTarget.getAttribute('data-name');
    const inputId = `repay-${name.replace(/\s/g, '_')}`;
    const amountInput = document.getElementById(inputId);
    
    const amount = parseFloat(amountInput.value) || 0;

    if (amount <= 0 || !activeDebtors[name] || activeDebtors[name] === 0) {
        showToast("⚠️ مبلغ السداد غير صحيح أو لا يوجد دين على هذا العميل.", 'error');
        return;
    }
    
    // المبلغ المسدد لا يجب أن يتجاوز الدين المتبقي
    const repaidAmount = Math.min(amount, activeDebtors[name]);
    
    // 1. تحديث الدين النشط
    activeDebtors[name] -= repaidAmount;
    if (activeDebtors[name] < 0.01) {
        delete activeDebtors[name]; // إزالة المدين إذا سدد كل دينه
    }

    // 2. تحديث إجمالي السداد لتقرير اليوم
    todayData.totalRepaid += repaidAmount;
    
    amountInput.value = ''; // تصفير حقل الإدخال
    
    renderActiveDebtors(); // إعادة عرض قائمة المدينين
    updateMainCalculations(); // تحديث الحسابات والواجهة
    showToast(`✅ تم سداد ${formatNumber(repaidAmount)} من قبل ${name}.`, 'success');
}

async function handleEndDay() {
    
    // 🌟 التحقق من اسم البائع 
    const sellerName = document.getElementById('seller-name-input').value.trim();
    if (!sellerName) {
        showToast("⚠️ يجب إدخال اسم البائع الحالي قبل إنهاء اليوم!", 'error');
        return;
    }
    
    // تأكيد إنهاء اليوم
    if (!confirm('هل أنت متأكد من إنهاء يوم العمل وتسجيل التقرير؟')) {
        return;
    }

    const totalSales = todayData.totalSales;
    const commission = calculateCommission(totalSales);

    // 1. بناء التقرير النهائي
    const finalReport = {
        reportName: "بيع محل المصنع", // اسم التقرير المطلوب
        
        // 🌟 التاريخ والوقت والدقيقة والثانية واليوم 
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        
        seller: sellerName, // اسم البائع
        
        totalSales: totalSales,
        cash: todayData.cash,
        bank: todayData.bank,
        newDebtTotal: todayData.newDebtTotal, 
        totalRepaid: todayData.totalRepaid,
        commission: commission, // عمولة البيع
        netDue: totalSales + todayData.totalRepaid - commission, // المستحق النهائي
        
        // 🌟 الأشخاص المدينون ومبالغ الديون
        newDebts: todayData.newDebts, 
        
        // snapshot للديون النشطة (للسجلات)
        activeDebtorsSnapshot: activeDebtors, 
    };

    try {
        // 2. تسجيل التقرير في مجموعة dailyReports
        await DAILY_REPORTS_COLLECTION.add(finalReport);
        
        // 3. تحديث قائمة المدينين النشطين (بإضافة الديون الجديدة)
        // دمج الديون الجديدة إلى قائمة activeDebtors
        for (const [name, amount] of Object.entries(todayData.newDebts)) {
            activeDebtors[name] = (activeDebtors[name] || 0) + amount;
        }
        
        // 4. تصفير بيانات اليوم الحالي وحفظ قائمة المدينين المحدثة
        await TODAY_DATA_DOC.delete(); // حذف وثيقة اليوم
        await DEBTORS_LIST_DOC.set(activeDebtors); // حفظ قائمة المدينين المحدثة
        
        // 5. عرض الملخص قبل تصفير الواجهة
        displayFinalReport(finalReport);
        document.getElementById('report-modal').classList.remove('hidden');

    } catch (error) {
        console.error("خطأ في تسجيل التقرير وإنهاء اليوم:", error);
        showToast("فشل في تسجيل التقرير وإنهاء اليوم على الخادم ❌", 'error');
    }
}

async function startNewDay() {
    // تصفير المتغيرات المحلية لبدء يوم جديد
    todayData = {
        cash: 0,
        bank: 0,
        newDebtTotal: 0,
        totalSales: 0,
        totalRepaid: 0,
        newDebts: {},
    };
    
    // إعادة تهيئة في Firestore
    await TODAY_DATA_DOC.set(todayData); 

    // إغلاق المودال وتحديث الواجهة
    document.getElementById('report-modal').classList.add('hidden');
    updateMainCalculations(); 
    updateInputsFromData();
    renderActiveDebtors();
    
    showToast("بدء يوم عمل جديد بنجاح! 🚀", 'success');
}

function displayFinalReport(report) {
    const content = document.getElementById('final-report-content');
    const { fullDateTime } = formatDateAndDay({ toDate: () => new Date() });
    
    content.innerHTML = `
        <p class="text-sm font-medium text-gray-700">تاريخ التسجيل: ${fullDateTime}</p>
        <p class="text-lg font-bold text-green-700 mt-2">👤 البائع: ${report.seller}</p>
        <hr class="my-3">
        <p class="font-bold text-gray-800">الإجمالي: <span class="text-xl text-indigo-800">${formatNumber(report.totalSales)}</span></p>
        <p class="text-gray-700">كاش: ${formatNumber(report.cash)}</p>
        <p class="text-gray-700">بنكك: ${formatNumber(report.bank)}</p>
        <p class="text-gray-700">ديون جديدة: ${formatNumber(report.newDebtTotal)}</p>
        <p class="text-gray-700">عمولة البيع: <span class="text-red-600">${formatNumber(report.commission)}</span></p>
        <hr class="my-3">
        <p class="font-bold text-gray-800">الصافي المستحق: <span class="text-2xl text-red-700">${formatNumber(report.netDue)}</span></p>
    `;
}

// =======================================================
// 🚀 ربط الأحداث (Event Listeners)
// =======================================================

// 1. مدخلات المبيعات
document.getElementById('input-cash').addEventListener('input', handleSalesInput);
document.getElementById('input-bank').addEventListener('input', handleSalesInput);
document.getElementById('input-new-debt-total').addEventListener('input', handleSalesInput);

// 2. إدارة الديون الجديدة
document.getElementById('add-debt-btn').addEventListener('click', handleAddNewDebt);

// 3. إنهاء اليوم
document.getElementById('end-day-btn').addEventListener('click', handleEndDay);
document.getElementById('start-new-day-btn').addEventListener('click', startNewDay);

// 4. التحكم في التبويبات (Tabs)
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const targetTab = e.target.getAttribute('data-tab');
        
        // إزالة حالة التفعيل من جميع الأزرار والمحتوى
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('bg-blue-500', 'text-white', 'hover:bg-gray-200');
            btn.classList.add('text-gray-700', 'hover:bg-gray-200');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // تفعيل الزر والمحتوى المطلوب
        e.target.classList.add('bg-blue-500', 'text-white');
        e.target.classList.remove('text-gray-700', 'hover:bg-gray-200');
        document.getElementById(targetTab).classList.add('active');
        
        // تحديث قائمة المدينين عند فتح علامة تبويب السداد
        if (targetTab === 'tab3') {
            renderActiveDebtors();
        }
    });
});

// يتم استدعاء loadData() من دالة checkAuthenticationAndRole() في index.html