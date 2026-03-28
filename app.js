// app.js - هذا هو الكود الرئيسي، لا يحتوي على أي معلومات حساسة
// يستورد كل شيء من config.js

import { db, helpers } from './config.js';

// ==========================================
// STATE MANAGEMENT
// ==========================================

const state = {
    balances: { cash: 0, bank: 0 },
    safeBalance: 0,
    todayStats: { sales: 0, shopExpenses: 0, personalExpenses: 0 },
    transactions: [],
    lastTransaction: { time: 0, type: '', amount: 0, name: '' },
    currentUser: null
};

// ==========================================
// UI FUNCTIONS
// ==========================================

const ui = {
    // تحديث عرض الأرصدة
    updateBalances: () => {
        document.getElementById('cashBalance').textContent = state.balances.cash.toLocaleString();
        document.getElementById('bankBalance').textContent = state.balances.bank.toLocaleString();
        document.getElementById('availableCash').textContent = state.balances.cash.toLocaleString();
        document.getElementById('lastSync').textContent = 'آخر تحديث: ' + helpers.formatTime(Date.now());
    },

    // تحديث الإحصائيات
    updateStats: () => {
        document.getElementById('todaySales').textContent = state.todayStats.sales.toLocaleString();
        document.getElementById('todayExpenses').textContent = state.todayStats.shopExpenses.toLocaleString();
        document.getElementById('todayPersonal').textContent = state.todayStats.personalExpenses.toLocaleString();
    },

    // تحديث قائمة العمليات
    updateTransactions: () => {
        const container = document.getElementById('recentTransactions');
        
        if (state.transactions.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-400 py-4 text-sm">لا توجد عمليات حتى الآن</div>';
            return;
        }

        const styles = {
            sales: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            shopExpense: 'bg-red-100 text-red-700 border-red-200',
            personalExpense: 'bg-blue-100 text-blue-700 border-blue-200',
            safe: 'bg-purple-100 text-purple-700 border-purple-200',
            transfer: 'bg-slate-100 text-slate-500 border-slate-200 line-through decoration-slate-400 opacity-60'
        };

        const emojis = {
            sales: '🟢',
            shopExpense: '🔴',
            personalExpense: '🔵',
            safe: '🟣',
            transfer: '⇄'
        };

        container.innerHTML = state.transactions.slice(0, 5).map(t => `
            <div class="flex justify-between items-center p-3 rounded-xl border ${styles[t.type] || styles.sales}">
                <div class="flex items-center gap-2">
                    <span>${emojis[t.type] || '⚪'}</span>
                    <div>
                        <div class="font-semibold text-sm">${t.title}</div>
                        <div class="text-xs opacity-75">${helpers.formatTime(t.timestamp)} • ${t.uid || ''}</div>
                    </div>
                </div>
                <div class="text-left font-bold">
                    ${t.type === 'transfer' ? '<span class="text-xs">(محايد)</span>' : Math.abs(t.amount).toLocaleString()}
                </div>
            </div>
        `).join('');
    },

    // تحديث الساعة
    updateClock: () => {
        const now = new Date();
        document.getElementById('clock').textContent = now.toLocaleTimeString('ar-SA', { hour12: false });
        document.getElementById('date').textContent = helpers.formatDate(now);
        document.getElementById('currentUID').textContent = 'UID: ' + helpers.generateUID();
    },

    // إظهار/إخفاء الصفحات
    showLogin: () => {
        document.getElementById('loginPage').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    },

    showApp: () => {
        document.getElementById('loginPage').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        document.getElementById('userEmail').textContent = '👤 ' + (state.currentUser?.email || '');
    },

    // المودالات
    toggleModal: (type, show) => {
        const modal = document.getElementById(type + 'Modal');
        if (show) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            // إعادة تعيين النماذج
            const form = document.getElementById(type + 'Form');
            if (form) form.reset();
        }
    },

    toggleSidebar: () => {
        const sidebar = document.getElementById('sidebar');
        const content = document.getElementById('sidebarContent');
        
        if (sidebar.classList.contains('hidden')) {
            sidebar.classList.remove('hidden');
            setTimeout(() => content.classList.remove('translate-x-full'), 10);
        } else {
            content.classList.add('translate-x-full');
            setTimeout(() => sidebar.classList.add('hidden'), 300);
        }
    }
};

// ==========================================
// AUTHENTICATION
// ==========================================

const auth = {
    init: () => {
        db.auth.onAuthChange((user) => {
            state.currentUser = user;
            if (user) {
                ui.showApp();
                data.initListeners();
            } else {
                ui.showLogin();
            }
        });
    },

    login: async (email, password) => {
        try {
            await db.auth.login(email, password);
            return { success: true };
        } catch (error) {
            return { success: false, error: auth.translateError(error.code) };
        }
    },

    signup: async (email, password) => {
        try {
            await db.auth.signup(email, password);
            return { success: true };
        } catch (error) {
            return { success: false, error: auth.translateError(error.code) };
        }
    },

    logout: async () => {
        try {
            await db.auth.logout();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    translateError: (code) => {
        const errors = {
            'auth/invalid-email': 'البريد الإلكتروني غير صالح',
            'auth/user-disabled': 'تم تعطيل الحساب',
            'auth/user-not-found': 'لم يتم العثور على الحساب',
            'auth/wrong-password': 'كلمة المرور غير صحيحة',
            'auth/email-already-in-use': 'البريد الإلكتروني مستخدم بالفعل',
            'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
            'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة'
        };
        return errors[code] || 'حدث خطأ. يرجى المحاولة مرة أخرى';
    }
};

// ==========================================
// DATA OPERATIONS
// ==========================================

const data = {
    initListeners: () => {
        // الاستماع للأرصدة
        db.balances.onChange((snap) => {
            state.balances = snap.val() || { cash: 0, bank: 0 };
            ui.updateBalances();
        });

        // الاستماع للخزنة
        db.safe.onChange((snap) => {
            state.safeBalance = (snap.val()?.amount) || 0;
            document.getElementById('safeBalanceModal').textContent = state.safeBalance.toLocaleString();
        });

        // الاستماع للإحصائيات
        const statsRef = db.database?.ref('stats/today') || { on: () => {} };
        onValue(ref(db.database, 'stats/today'), (snap) => {
            state.todayStats = snap.val() || { sales: 0, shopExpenses: 0, personalExpenses: 0 };
            ui.updateStats();
        });

        // الاستماع للعمليات
        db.transactions.onChange((snap) => {
            const txs = [];
            snap.forEach((child) => txs.push({ id: child.key, ...child.val() }));
            state.transactions = txs.reverse();
            ui.updateTransactions();
        });

        // الاستماع لآخر عملية
        db.lastTransaction.onChange((snap) => {
            state.lastTransaction = snap.val() || { time: 0 };
        });
    },

    // إنشاء عملية بيع
    createSale: async (formData) => {
        const { amount, payment, dept, period } = formData;
        const uid = helpers.generateUID();
        const timestamp = Date.now();

        // تحديث الأرصدة
        const balanceUpdate = {};
        balanceUpdate[payment === 'كاش' ? 'cash' : 'bank'] = 
            (payment === 'كاش' ? state.balances.cash : state.balances.bank) + parseFloat(amount);

        // تحديث الإحصائيات
        const currentStats = (await db.stats.get()).val() || { sales: 0 };

        await Promise.all([
            db.balances.update(balanceUpdate),
            db.stats.update({ sales: currentStats.sales + parseFloat(amount) }),
            db.transactions.push({
                type: 'sales',
                title: `مبيعات ${dept} - ${period} (${payment})`,
                amount: parseFloat(amount),
                timestamp,
                uid,
                payment,
                dept,
                period
            }),
            db.lastTransaction.set({
                time: timestamp,
                type: 'sales',
                amount: parseFloat(amount),
                name: dept
            })
        ]);

        return { success: true };
    },

    // إنشاء مصروف
    createExpense: async (formData) => {
        const { amount, name, type, payment, vendor } = formData;

        // التحقق من التكرار
        if (helpers.checkDuplicate(state.lastTransaction, type, name, amount)) {
            throw new Error('DUPLICATE');
        }

        const uid = helpers.generateUID();
        const timestamp = Date.now();

        // تحديث الأرصدة
        const balanceUpdate = {};
        balanceUpdate[payment === 'كاش' ? 'cash' : 'bank'] = 
            (payment === 'كاش' ? state.balances.cash : state.balances.bank) - parseFloat(amount);

        // تحديث الإحصائيات
        const currentStats = (await db.stats.get()).val() || {};
        const statsUpdate = {};
        statsUpdate[type === 'محل' ? 'shopExpenses' : 'personalExpenses'] = 
            (currentStats[type === 'محل' ? 'shopExpenses' : 'personalExpenses'] || 0) + parseFloat(amount);

        await Promise.all([
            db.balances.update(balanceUpdate),
            db.stats.update(statsUpdate),
            db.transactions.push({
                type: type === 'محل' ? 'shopExpense' : 'personalExpense',
                title: `${type === 'محل' ? '🔴' : '🔵'} ${name} ${vendor ? '(' + vendor + ')' : ''}`,
                amount: -parseFloat(amount),
                timestamp,
                uid,
                payment,
                expenseType: type,
                vendor: vendor || ''
            }),
            db.lastTransaction.set({
                time: timestamp,
                type: type,
                amount: parseFloat(amount),
                name: name
            })
        ]);

        return { success: true };
    },

    // إنشاء تحويل (Zero-Impact)
    createTransfer: async (formData) => {
        const { amount, from, to } = formData;
        
        if (from === to) {
            throw new Error('SAME_ACCOUNT');
        }

        const uid = helpers.generateUID();
        const timestamp = Date.now();

        // تحديث الأرصدة (Zero-Impact)
        const balanceUpdate = {};
        if (from === 'كاش') {
            balanceUpdate.cash = state.balances.cash - parseFloat(amount);
            balanceUpdate.bank = state.balances.bank + parseFloat(amount);
        } else {
            balanceUpdate.bank = state.balances.bank - parseFloat(amount);
            balanceUpdate.cash = state.balances.cash + parseFloat(amount);
        }

        await Promise.all([
            db.balances.update(balanceUpdate),
            db.transactions.push({
                type: 'transfer',
                title: `⇄ تبديل: ${from} → ${to} (محايد)`,
                amount: 0,
                timestamp,
                uid,
                from,
                to,
                transferAmount: parseFloat(amount)
            })
        ]);

        return { success: true };
    },

    // عملية الخزنة
    createSafeOperation: async (formData) => {
        const { amount, operation } = formData;
        const numAmount = parseFloat(amount);

        if (operation === 'add' && state.balances.cash < numAmount) {
            throw new Error('INSUFFICIENT_CASH');
        }
        if (operation === 'remove' && state.safeBalance < numAmount) {
            throw new Error('INSUFFICIENT_SAFE');
        }

        const uid = helpers.generateUID();
        const timestamp = Date.now();

        const balanceUpdate = {};
        const safeUpdate = {};

        if (operation === 'add') {
            balanceUpdate.cash = state.balances.cash - numAmount;
            safeUpdate.amount = state.safeBalance + numAmount;
        } else {
            balanceUpdate.cash = state.balances.cash + numAmount;
            safeUpdate.amount = state.safeBalance - numAmount;
        }

        await Promise.all([
            db.balances.update(balanceUpdate),
            db.safe.set(safeUpdate),
            db.transactions.push({
                type: 'safe',
                title: `🏦 ${operation === 'add' ? 'إيداع' : 'سحب'} من الخزنة`,
                amount: operation === 'add' ? numAmount : -numAmount,
                timestamp,
                uid,
                operation
            })
        ]);

        return { success: true };
    }
};

// ==========================================
// EVENT HANDLERS
// ==========================================

const handlers = {
    init: () => {
        // نموذج تسجيل الدخول
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            const result = await auth.login(email, password);
            if (!result.success) {
                document.getElementById('loginError').textContent = result.error;
                document.getElementById('loginError').classList.remove('hidden');
            }
        });

        // تبديل وضع التسجيل/الدخول
        document.getElementById('authToggle').addEventListener('click', () => {
            const isLogin = document.getElementById('authToggle').textContent.includes('ليس لديك');
            document.getElementById('authToggle').textContent = isLogin ? 'لديك حساب؟ سجل دخول' : 'ليس لديك حساب؟ سجل الآن';
            document.querySelector('#loginForm button[type="submit"]').textContent = isLogin ? 'إنشاء حساب' : 'تسجيل الدخول';
        });

        // تسجيل الخروج
        document.querySelector('header button[onclick="logout()"]').addEventListener('click', auth.logout);

        // الساعة
        setInterval(ui.updateClock, 1000);
        ui.updateClock();

        // أزرار الاختيار
        handlers.setupSelectionButtons();
        
        // إغلاق المودالات بالنقر خارجها
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    const type = modal.id.replace('Modal', '');
                    ui.toggleModal(type, false);
                }
            });
        });
    },

    setupSelectionButtons: () => {
        // دوال مساعدة للأزرار
        window.selectDept = (btn) => handlers.selectButton(btn, '.dept-btn', 'salesDept', 'emerald');
        window.selectPeriod = (btn) => handlers.selectButton(btn, '.period-btn', 'salesPeriod', 'emerald');
        window.selectPayment = (btn) => handlers.selectButton(btn, '.payment-btn', 'salesPayment', btn.dataset.value === 'كاش' ? 'emerald' : 'blue');
        window.selectType = (btn) => handlers.selectButton(btn, '.type-btn', 'expenseType', btn.dataset.value === 'محل' ? 'red' : 'blue');
        window.selectExpPayment = (btn) => handlers.selectButton(btn, '.exp-payment-btn', 'expensePayment', btn.dataset.value === 'كاش' ? 'emerald' : 'blue');
        window.selectFrom = (btn) => {
            handlers.selectButton(btn, '.from-btn', 'transferFrom', btn.dataset.value === 'كاش' ? 'emerald' : 'blue');
            // تحديث "إلى" تلقائياً
            const toValue = btn.dataset.value === 'كاش' ? 'بنكك' : 'كاش';
            document.querySelector(`.to-btn[data-value="${toValue}"]`).click();
        };
        window.selectTo = (btn) => handlers.selectButton(btn, '.to-btn', 'transferTo', btn.dataset.value === 'كاش' ? 'emerald' : 'blue');
        window.selectSafeOp = (btn) => handlers.selectButton(btn, '.safe-op-btn', 'safeOperation', btn.dataset.value === 'add' ? 'emerald' : 'red');
    },

    selectButton: (btn, selector, inputId, color) => {
        document.querySelectorAll(selector).forEach(b => {
            b.classList.remove(`border-${color}-500`, `bg-${color}-50`, 'border-emerald-500', 'bg-emerald-50', 'border-blue-500', 'bg-blue-50', 'border-red-500', 'bg-red-50');
            b.classList.add('border-slate-200');
        });
        btn.classList.remove('border-slate-200');
        btn.classList.add(`border-${color}-500`, `bg-${color}-50`);
        document.getElementById(inputId).value = btn.dataset.value;
    },

    // معالجات النماذج
    handleSalesSubmit: async (e) => {
        e.preventDefault();
        const formData = {
            amount: document.getElementById('salesAmount').value,
            payment: document.getElementById('salesPayment').value,
            dept: document.getElementById('salesDept').value,
            period: document.getElementById('salesPeriod').value
        };

        if (!formData.dept || !formData.period) {
            alert('الرجاء اختيار القسم والفترة');
            return;
        }

        try {
            await data.createSale(formData);
            ui.toggleModal('sales', false);
        } catch (error) {
            alert('حدث خطأ: ' + error.message);
        }
    },

    handleExpenseSubmit: async (e) => {
        e.preventDefault();
        const formData = {
            amount: document.getElementById('expenseAmount').value,
            name: document.getElementById('expenseName').value,
            type: document.getElementById('expenseType').value,
            payment: document.getElementById('expensePayment').value,
            vendor: document.getElementById('expenseVendor').value
        };

        try {
            await data.createExpense(formData);
            ui.toggleModal('expenses', false);
            document.getElementById('duplicateWarning').classList.add('hidden');
        } catch (error) {
            if (error.message === 'DUPLICATE') {
                document.getElementById('duplicateWarning').classList.remove('hidden');
            } else {
                alert('حدث خطأ: ' + error.message);
            }
        }
    },

    handleTransferSubmit: async (e) => {
        e.preventDefault();
        const formData = {
            amount: document.getElementById('transferAmount').value,
            from: document.getElementById('transferFrom').value,
            to: document.getElementById('transferTo').value
        };

        try {
            await data.createTransfer(formData);
            ui.toggleModal('transfer', false);
        } catch (error) {
            if (error.message === 'SAME_ACCOUNT') {
                alert('لا يمكن التحويل لنفس الحساب!');
            } else {
                alert('حدث خطأ: ' + error.message);
            }
        }
    },

    handleSafeSubmit: async (e) => {
        e.preventDefault();
        const formData = {
            amount: document.getElementById('safeAmount').value,
            operation: document.getElementById('safeOperation').value
        };

        try {
            await data.createSafeOperation(formData);
            ui.toggleModal('safe', false);
        } catch (error) {
            const messages = {
                'INSUFFICIENT_CASH': '⚠️ رصيد الكاش غير كافٍ!',
                'INSUFFICIENT_SAFE': '⚠️ رصيد الخزنة غير كافٍ!'
            };
            alert(messages[error.message] || 'حدث خطأ');
        }
    },

    confirmDuplicate: () => {
        document.getElementById('duplicateWarning').classList.add('hidden');
        // إعادة الإرسال بدون تحقق
        const formData = {
            amount: document.getElementById('expenseAmount').value,
            name: document.getElementById('expenseName').value,
            type: document.getElementById('expenseType').value,
            payment: document.getElementById('expensePayment').value,
            vendor: document.getElementById('expenseVendor').value
        };
        data.createExpense(formData).then(() => ui.toggleModal('expenses', false));
    },

    cancelDuplicate: () => {
        document.getElementById('expenseName').value = '';
        document.getElementById('expenseAmount').value = '';
        document.getElementById('duplicateWarning').classList.add('hidden');
    }
};

// ==========================================
// INITIALIZATION
// ==========================================

// جعل الدوال متاحة عالمياً للـ HTML
window.toggleSidebar = ui.toggleSidebar;
window.openModal = (type) => ui.toggleModal(type, true);
window.closeModal = (type) => ui.toggleModal(type, false);
window.logout = auth.logout;
window.handleSalesSubmit = handlers.handleSalesSubmit;
window.handleExpenseSubmit = handlers.handleExpenseSubmit;
window.handleTransferSubmit = handlers.handleTransferSubmit;
window.handleSafeSubmit = handlers.handleSafeSubmit;
window.confirmDuplicate = handlers.confirmDuplicate;
window.cancelDuplicate = handlers.cancelDuplicate;
window.showPage = (page) => {
    // تحديث التنقل السفلي
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('text-emerald-600');
        btn.classList.add('text-slate-400');
    });
    document.getElementById('nav-' + page).classList.remove('text-slate-400');
    document.getElementById('nav-' + page).classList.add('text-emerald-600');
};

// بدء التطبيق
auth.init();
handlers.init();

console.log('✅ App initialized');
