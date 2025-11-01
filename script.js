// =======================================================
// script.js - منطق نظام إدارة المبيعات (مع ربط Firebase Firestore)
// هذا الملف يعتمد على تهيئة Firebase التي تمت في index.html
// =======================================================

// 🧠 1. كائن التخزين والتحميل الأولي والثوابت
// -------------------------------------------------------

const COMMISSION_CONSTS = {
    MIN_DAILY: 15000,
    UNIT_SALES: 8000,
    COMMISSION_PER_UNIT: 600,
};

let todayData = {
    cash: 0,
    bank: 0,
    newDebtTotal: 0,
    totalSales: 0,
    newDebts: {}, 
    totalNewDetailedDebt: 0, 
    totalRepaid: 0, 
};

let activeDebtors = {}; 

// =======================================================
// 🧮 2. الدوال المساعدة للحساب والتنسيق
// -------------------------------------------------------

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

function cleanNumber(value) {
    if (typeof value !== 'string') return 0;
    const cleaned = value.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
}

function formatNumber(number) {
    return new Intl.NumberFormat('en-US').format(number);
}

function calculateCommission(salesTotal) {
    let commission = Math.floor(salesTotal / COMMISSION_CONSTS.UNIT_SALES) * COMMISSION_CONSTS.COMMISSION_PER_UNIT;
    if (commission < COMMISSION_CONSTS.MIN_DAILY) {
        commission = COMMISSION_CONSTS.MIN_DAILY;
    }
    return commission;
}

// =======================================================
// 🔄 3. دوال التخزين والتحميل (Firebase Firestore)
// -------------------------------------------------------

async function loadData() {
    try {
        const debtorsDoc = await DEBTORS_LIST_DOC.get();
        if (debtorsDoc.exists) {
            activeDebtors = debtorsDoc.data().debtors || {};
        }

        const todayDoc = await TODAY_DATA_DOC.get();
        if (todayDoc.exists) {
            Object.assign(todayData, todayDoc.data());
        }

        updateInputsFromData();
        updateMainCalculations();
        
        showToast("تم تحميل بيانات اليوم والديون بنجاح من الخادم ✅", 'success');
    } catch (error) {
        console.error("خطأ في تحميل البيانات من Firebase:", error);
        showToast("فشل في تحميل البيانات من الخادم! ❌", 'error');
    }
}

async function saveTodayData() {
    try {
        await TODAY_DATA_DOC.set(todayData, { merge: true });
    } catch (error) {
        console.error("خطأ في حفظ بيانات اليوم المؤقتة:", error);
    }
}

async function saveActiveDebtors() {
    try {
        await DEBTORS_LIST_DOC.set({ debtors: activeDebtors });
    } catch (error) {
        console.error("خطأ في حفظ قائمة المدينين النشطين:", error);
    }
}

function updateInputsFromData() {
    document.getElementById('input-cash').value = formatNumber(todayData.cash);
    document.getElementById('input-bank').value = formatNumber(todayData.bank);
    document.getElementById('input-new-debt-total').value = formatNumber(todayData.newDebtTotal);
}

// =======================================================
// 📈 4. دوال التحديث والحساب الرئيسي
// -------------------------------------------------------

function updateMainCalculations() {
    todayData.totalSales = todayData.cash + todayData.bank + todayData.newDebtTotal;
    const commission = calculateCommission(todayData.totalSales);
    const netDue = todayData.totalSales + todayData.totalRepaid - commission; 

    document.getElementById('total-sales-display').textContent = formatNumber(todayData.totalSales);
    document.getElementById('summary-total-sales').textContent = formatNumber(todayData.totalSales);
    document.getElementById('summary-total-repaid').textContent = formatNumber(todayData.totalRepaid);
    document.getElementById('summary-commission').textContent = formatNumber(commission);
    document.getElementById('summary-net-due').textContent = formatNumber(netDue);
    
    updateDebtMatchIndicator();
    renderNewDebtList();
    renderActiveDebtorsList();
    updateDebtorsDatalist();
    
    saveTodayData();
}

function updateDebtMatchIndicator() {
    const totalRequired = todayData.newDebtTotal;
    const totalDetailed = todayData.totalNewDetailedDebt;
    const indicator = document.getElementById('match-indicator');
    const endDayBtn = document.getElementById('end-day-btn');
    const requiredDebtDisplay = document.getElementById('required-debt-display');
    const excessWarning = document.getElementById('debt-excess-warning');
    
    requiredDebtDisplay.textContent = formatNumber(totalRequired);
    const difference = totalRequired - totalDetailed;

    endDayBtn.classList.remove('bg-blue-500', 'bg-red-400', 'hover:bg-blue-600', 'hover:bg-red-600');
    indicator.classList.remove('text-green-700', 'text-red-700', 'text-sm', 'text-base');

    if (difference === 0 || totalRequired === 0) {
        indicator.innerHTML = `✅ **مطابق${totalRequired === 0 ? ' (لا ديون)' : ''}**`;
        indicator.classList.add('text-green-700', 'text-base');
        endDayBtn.disabled = false;
        endDayBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        excessWarning.classList.add('hidden');
    } else if (totalDetailed > totalRequired) {
        indicator.innerHTML = `⚠️ **زيادة في التفصيل** (${formatNumber(Math.abs(difference))})`;
        indicator.classList.add('text-red-700', 'text-sm');
        endDayBtn.disabled = true;
        endDayBtn.classList.add('bg-red-400', 'hover:bg-red-600');
        excessWarning.textContent = `⚠️ مجموع الديون المفصلة أكبر من الإجمالي بفارق: ${formatNumber(Math.abs(difference))}`;
        excessWarning.classList.remove('hidden');
    } else { 
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

function handleSalesInput(e) {
    const inputElement = e.target;
    const cleanValue = cleanNumber(inputElement.value);

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

function handleAddNewDebt() {
    const nameInput = document.getElementById('debtor-name');
    const amountInput = document.getElementById('debtor-amount');
    
    const name = nameInput.value.trim();
    const amount = cleanNumber(amountInput.value);

    if (!name || name.split(/\s+/).length < 2) {
        showToast("الرجاء إدخال **الاسم ثنائياً** على الأقل 📝", 'error');
        return;
    }
    
    if (amount <= 0) {
        showToast("الرجاء إدخال قيمة صحيحة للمبلغ.", 'error');
        return;
    }
    
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

function renderActiveDebtorsList() {
    const listContainer = document.getElementById('active-debtors-list');
    listContainer.innerHTML = '';
    
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
        
        const inputElement = item.querySelector('.repay-input');
        inputElement.addEventListener('input', (e) => {
             const cleanValue = cleanNumber(e.target.value);
             if (cleanValue === 0) {
                e.target.value = ''; 
            } else {
                e.target.value = formatNumber(cleanValue);
            }
        });
    });
}

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

        if (debtFromNew > 0 && remainingRepay > 0) {
            const debtToRepayFromNew = Math.min(remainingRepay, debtFromNew);
            todayData.newDebts[name] -= debtToRepayFromNew;
            todayData.totalNewDetailedDebt -= debtToRepayFromNew; 
            remainingRepay -= debtToRepayFromNew;
            totalRepaidFromThisDebt += debtToRepayFromNew;
            
            if (todayData.newDebts[name] <= 0) {
                delete todayData.newDebts[name];
            }
        }

        if (debtFromActive > 0 && remainingRepay > 0) {
            const debtToRepayFromActive = Math.min(remainingRepay, debtFromActive);
            activeDebtors[name] -= debtToRepayFromActive;
            remainingRepay -= debtToRepayFromActive;
            totalRepaidFromThisDebt += debtToRepayFromActive;

            if (activeDebtors[name] <= 0) {
                delete activeDebtors[name];
            }
        }
        
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
// 🛑 7. دوال إنهاء اليوم والتسجيل
// -------------------------------------------------------

async function handleEndDay() {
    const endDayBtn = document.getElementById('end-day-btn');
    
    if (endDayBtn.disabled) {
        const totalRequired = todayData.newDebtTotal;
        const totalDetailed = todayData.totalNewDetailedDebt;
        const difference = totalDetailed - totalRequired; 
        let errorMessage = `⚠️ لا يمكن إنهاء اليوم: هناك بيانات غير مكتملة أو غير مطابقة.`;

        if (difference > 0) {
             errorMessage = `⚠️ لا يمكن إنهاء اليوم: مجموع الديون المفصلة (${formatNumber(totalDetailed)}) **أكبر** من إجمالي الديون الجديدة (${formatNumber(totalRequired)}) بفارق ${formatNumber(difference)}.`;
        } else if (difference < 0) {
             errorMessage = `⚠️ لا يمكن إنهاء اليوم: يجب تفصيل المبلغ المتبقي: ${formatNumber(Math.abs(difference))}.`;
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

    await saveActiveDebtors(); 
    showFinalReport();
}

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

async function startNewDay() {
    
    const finalReport = {
        date: new Date().toISOString().split('T')[0],
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        totalSales: todayData.totalSales,
        cash: todayData.cash,
        bank: todayData.bank,
        totalRepaid: todayData.totalRepaid,
        newDebts: todayData.newDebts,
        commission: calculateCommission(todayData.totalSales),
        netDue: todayData.totalSales + todayData.totalRepaid - calculateCommission(todayData.totalSales),
        activeDebtorsSnapshot: activeDebtors, 
    };

    try {
        await DAILY_REPORTS_COLLECTION.add(finalReport);
        await TODAY_DATA_DOC.delete(); 
        
        todayData.cash = 0;
        todayData.bank = 0;
        todayData.newDebtTotal = 0;
        todayData.newDebts = {};
        todayData.totalNewDetailedDebt = 0;
        todayData.totalRepaid = 0;

        document.getElementById('report-modal').classList.add('hidden');
        updateMainCalculations(); 
        updateInputsFromData();
        
        showToast("بدء يوم عمل جديد بنجاح! 🚀", 'success');

    } catch (error) {
        console.error("خطأ في إنهاء اليوم وتسجيل التقرير:", error);
        showToast("فشل في تسجيل التقرير وإنهاء اليوم على الخادم ❌", 'error');
    }
}

// =======================================================
// 🚀 8. تهيئة التطبيق (Initial Setup)
// -------------------------------------------------------

function updateClockAndDate() {
    const now = new Date();
    document.getElementById('current-day-name').textContent = now.toLocaleDateString('ar-EG', { weekday: 'long' });
    document.getElementById('current-date').textContent = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    document.getElementById('live-clock').textContent = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}


// ربط الأحداث الرئيسية
document.getElementById('add-debt-btn').addEventListener('click', handleAddNewDebt);
document.getElementById('new-debt-list').addEventListener('click', handleDeleteDebt);
document.getElementById('active-debtors-list').addEventListener('click', handleRepayment);
document.getElementById('end-day-btn').addEventListener('click', handleEndDay);
document.getElementById('start-new-day-btn').addEventListener('click', startNewDay);

// ربط جميع أحداث الإدخال
['input-cash', 'input-bank', 'input-new-debt-total'].forEach(id => {
    document.getElementById(id).addEventListener('input', handleSalesInput);
});

// ربط وظيفة التبديل بين التبويبات 
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const tabId = e.target.getAttribute('data-tab');
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('bg-blue-500', 'text-white');
            btn.classList.add('text-gray-700', 'hover:bg-gray-200');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        e.target.classList.add('bg-blue-500', 'text-white');
        e.target.classList.remove('text-gray-700', 'hover:bg-gray-200');
        document.getElementById(tabId).classList.add('active');
    });
});

updateClockAndDate();
setInterval(updateClockAndDate, 1000); 

loadData();
