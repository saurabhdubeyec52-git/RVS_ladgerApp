import { createContext, useContext, useState, useCallback } from 'react'

const STORAGE_KEY = 'app.lang'

const dict = {
  en: {
    // Common / nav
    appName: 'RVS Ledger',
    dashboard: 'Dashboard',
    customers: 'Customers',
    settledMenu: 'Fully settled',
    noSettled: 'No fully settled customers yet.',
    notifications: 'Notifications',
    restore: 'Restore',
    deletePermanently: 'Delete permanently',
    deleteConfirm: 'Are you sure you want to delete this promise?',
    archivedData: 'Archived data',
    noArchivedData: 'No archived entries.',
    purgeTxTitle: 'Delete permanently',
    purgeTxMsg: 'Permanently delete this ledger entry? This cannot be undone.',
    signedInAs: 'Signed in as {name}',
    logout: 'Log out',
    loading: 'Loading…',
    syncing: 'Syncing…',
    settings: 'Settings',
    light: 'Light',
    dark: 'Dark',
    changeTheme: 'Change theme',
    changeLanguage: 'Change language',
    next: 'Next',
    toastSaved: 'Customer saved',
    toastArchived: 'Customer archived',
    toastRestored: 'Restored',
    toastDeleted: 'Deleted permanently',
    toastEntryAdded: 'Ledger entry added',
    toastEntryUpdated: 'Ledger entry updated',
    toastEntryArchived: 'Ledger entry archived',
    toastEntryRestored: 'Entry restored',
    toastPromiseSaved: 'Promise saved',
    toastPaymentRecorded: 'Payment recorded',
    toastRescheduled: 'Promised day updated',
    toastPaymentRescheduled: 'Payment recorded & promised day updated',
    cancel: 'Cancel',
    confirm: 'Confirm',
    edit: 'Edit',
    delete: 'Delete',
    actions: 'Action',
    serialNo: 'S.No.',
    back: 'Back',
    searchTables: 'Search…',
    sortBy: 'Sort by',
    filterArea: 'Area',
    allAreas: 'All areas',
    balanceStatus: 'Balance',
    allStatuses: 'All balances',
    statusOwes: 'Owes',
    statusClear: 'Clear',
    statusAdvance: 'In advance',
    filterType: 'Type',
    allTypes: 'All types',
    sortDaysOverdue: 'Most overdue',
    sortAmountDesc: 'Highest amount',
    sortNameAsc: 'Name (A–Z)',
    add: 'Add',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    notes: 'Notes',
    amount: 'Amount',
    date: 'Date',
    type: 'Type',
    description: 'Description',

    // Login
    createAdminTitle: 'Create admin account',
    username: 'Username',
    password: 'Password',
    confirmPassword: 'Confirm password',
    createAccount: 'Create account',
    signIn: 'Sign in',
    pleaseWait: 'Please wait…',
    passwordsDoNotMatch: 'Passwords do not match',

    // Dashboard
    checkOverdue: 'Check overdue',
    printPdf: 'Print',
    generatedOn: 'Generated on',
    totalCustomers: 'Total customers',
    totalOutstanding: 'Total outstanding',
    ledgerTransactions: 'Ledger transactions',
    pendingFuture: 'Pending (future promise) Payment',
    fullySettled: 'Fully settled / clear',
    overduePayments: 'Overdue payments',
    viewAll: 'View all →',
    noOverdue: '🎉 No overdue payments.',
    colPromised: 'Promised_Day',
    colDaysOverdue: 'Days overdue',
    daysShort: '{n}d',
    customer: 'Customer',
    allTransactionsTitle: 'Ledger transactions',
    noTransactionsAll: 'No ledger transactions yet.',
    pendingPaymentsTitle: 'Pending payments',
    noPendingPayments: 'No pending payments.',

    // Customers
    registerCustomer: '+ Register customer',
    searchPlaceholder: 'Search by name, phone or email…',
    noCustomers: 'No customers yet. Register your first customer.',
    balance: 'Balance',
    archive: 'Archive',
    archivedMenu: 'Archived',
    archivedTitle: 'Archived customers',
    noArchivedCustomers: 'No archived customers.',
    archiveCustomer: 'Archive customer',
    archiveCustomerMsg:
      'Archive {name}? They move to Archived history (their ledger is kept) and can be restored later.',
    purgeCustomerTitle: 'Delete permanently',
    purgeCustomerMsg:
      'Permanently delete {name}? This also removes their ledger and payment history and cannot be undone.',
    archivedOn: 'Archived on',

    // Customer form
    editCustomer: 'Edit customer',
    nameRequired: 'Name *',
    phoneRequired: 'Phone *',
    phoneInvalid: 'Enter a valid 10-digit mobile number.',
    phonePlaceholder: '10-digit number',
    area: 'Area',
    areaRequired: 'Area *',
    areaPlaceholder: 'Select or type a new area',
    saveChanges: 'Save changes',
    register: 'Register',
    saving: 'Saving…',

    // Customer detail
    details: 'Details',
    balanceTitle: 'Balance',
    totalDebit: 'Total debit (charged)',
    totalCredit: 'Total credit (paid)',
    outstanding: 'Outstanding',
    overdueLabel: '⚠️ Overdue',
    promisedLabel: '⏳ Promised',
    promiseBy: '{label}: {amount} by {date}',
    addLedgerEntry: 'Add ledger entry',
    editLedgerEntry: 'Edit ledger entry',
    uploadPhoto: 'Upload supported photo',
    viewPhoto: 'View',
    supportedDocs: 'Supported docs',
    closeLabel: 'Close',
    debitOption: 'Debit — customer charged',
    creditOption: 'Credit — payment received',
    amountField: 'Amount (₹)',
    descOptional: 'Description (optional)',
    promisedPaymentDate: 'Promised payment date',
    pendingAmountField: 'Pending amount (₹)',
    savePromise: 'Save promise',
    noOutstandingPromise: 'No outstanding balance — nothing to promise.',
    ledgerHistory: 'Ledger history',
    noTransactions: 'No transactions yet.',
    credit: 'credit',
    debit: 'debit',

    // Money badge
    owes: 'Owes',
    advance: 'Advance',
    settled: 'Settled',

    // Notifications
    recheckNow: 'Re-check now',
    notifIntro:
      'Customers who did not clear their pending payment by the promised date. Review the details, then call them to discuss clearing the dues.',
    noOverdueNow: '🎉 No overdue payments right now.',
    daysOverdue: '{n} days overdue',
    pending: 'Pending',
    promisedDate: 'Promised date',
    callPhone: '📞 Call {phone}',
    openProfile: 'Open profile',
    markAsPaid: 'Mark as paid',
    paymentSummary: 'Payment summary',
    promisedAmount: 'Promised amount',
    amountReceived: 'Amount received',
    newPromisedDate: 'New promised day',
    amountInvalid: 'Enter a valid amount.',
    afterUpdate: 'After update',
    paidNow: 'Paid now',
    remaining: 'Remaining',
    willSettle: 'Will be settled & removed',
    update: 'Update'
  },

  hi: {
    // Common / nav
    appName: 'RVS Ledger',
    dashboard: 'डैशबोर्ड',
    customers: 'ग्राहक',
    settledMenu: 'पूर्ण निपटान',
    noSettled: 'अभी तक कोई पूर्ण निपटान ग्राहक नहीं।',
    notifications: 'सूचनाएं',
    restore: 'पुनर्स्थापित करें',
    deletePermanently: 'स्थायी रूप से हटाएं',
    archivedData: 'संग्रहित डेटा',
    noArchivedData: 'कोई संग्रहित प्रविष्टि नहीं।',
    purgeTxTitle: 'स्थायी रूप से हटाएं',
    purgeTxMsg: 'इस बही प्रविष्टि को स्थायी रूप से हटाएं? यह वापस नहीं किया जा सकता।',
    signedInAs: 'लॉग इन: {name}',
    logout: 'लॉग आउट',
    loading: 'लोड हो रहा है…',
    syncing: 'समन्वयन…',
    settings: 'सेटिंग्स',
    light: 'लाइट',
    dark: 'डार्क',
    changeTheme: 'थीम बदलें',
    changeLanguage: 'भाषा बदलें',
    next: 'अगला',
    toastSaved: 'ग्राहक सहेजा गया',
    toastArchived: 'ग्राहक संग्रहित किया गया',
    toastRestored: 'पुनर्स्थापित किया गया',
    toastDeleted: 'स्थायी रूप से हटाया गया',
    toastEntryAdded: 'बही प्रविष्टि जोड़ी गई',
    toastEntryUpdated: 'बही प्रविष्टि अपडेट की गई',
    toastEntryArchived: 'बही प्रविष्टि संग्रहित की गई',
    toastEntryRestored: 'प्रविष्टि पुनर्स्थापित की गई',
    toastPromiseSaved: 'वादा सहेजा गया',
    toastPaymentRecorded: 'भुगतान दर्ज किया गया',
    toastRescheduled: 'वादा दिन अपडेट किया गया',
    toastPaymentRescheduled: 'भुगतान दर्ज और वादा दिन अपडेट किया गया',
    cancel: 'रद्द करें',
    confirm: 'पुष्टि करें',
    edit: 'संपादित करें',
    delete: 'हटाएं',
    actions: 'कार्रवाई',
    serialNo: 'क्रम सं.',
    back: 'वापस',
    searchTables: 'खोजें…',
    sortBy: 'इसके अनुसार क्रमबद्ध करें',
    filterArea: 'क्षेत्र',
    allAreas: 'सभी क्षेत्र',
    balanceStatus: 'शेष राशि',
    allStatuses: 'सभी शेष',
    statusOwes: 'बकाया',
    statusClear: 'स्पष्ट',
    statusAdvance: 'अग्रिम',
    filterType: 'प्रकार',
    allTypes: 'सभी प्रकार',
    sortDaysOverdue: 'सर्वाधिक अतिदेय',
    sortAmountDesc: 'सर्वाधिक राशि',
    sortNameAsc: 'नाम (अ–ज्ञ)',
    add: 'जोड़ें',
    name: 'नाम',
    phone: 'फ़ोन',
    email: 'ईमेल',
    address: 'पता',
    notes: 'टिप्पणी',
    amount: 'राशि',
    date: 'तारीख',
    type: 'प्रकार',
    description: 'विवरण',

    // Login
    createAdminTitle: 'एडमिन खाता बनाएं',
    username: 'उपयोगकर्ता नाम',
    password: 'पासवर्ड',
    confirmPassword: 'पासवर्ड की पुष्टि करें',
    createAccount: 'खाता बनाएं',
    signIn: 'साइन इन करें',
    pleaseWait: 'कृपया प्रतीक्षा करें…',
    passwordsDoNotMatch: 'पासवर्ड मेल नहीं खाते',

    // Dashboard
    checkOverdue: 'बकाया जांचें',
    printPdf: 'प्रिंट',
    generatedOn: 'तैयार किया गया',
    totalCustomers: 'कुल ग्राहक',
    totalOutstanding: 'कुल बकाया',
    ledgerTransactions: 'बही लेनदेन',
    pendingFuture: 'लंबित भुगतान (भविष्य का वादा)',
    fullySettled: 'पूर्ण निपटान / स्पष्ट',
    overduePayments: 'अतिदेय भुगतान',
    viewAll: 'सभी देखें →',
    noOverdue: '🎉 कोई अतिदेय भुगतान नहीं।',
    colPromised: 'वादा भुगतान दिन',
    colDaysOverdue: 'दिन अतिदेय',
    daysShort: '{n} दिन',
    customer: 'ग्राहक',
    allTransactionsTitle: 'बही लेनदेन',
    noTransactionsAll: 'अभी तक कोई बही लेनदेन नहीं।',
    pendingPaymentsTitle: 'लंबित भुगतान',
    noPendingPayments: 'कोई लंबित भुगतान नहीं।',

    // Customers
    registerCustomer: '+ ग्राहक पंजीकृत करें',
    searchPlaceholder: 'नाम, फ़ोन या ईमेल से खोजें…',
    noCustomers: 'अभी तक कोई ग्राहक नहीं। अपना पहला ग्राहक पंजीकृत करें।',
    balance: 'शेष राशि',
    archive: 'संग्रह करें',
    archivedMenu: 'संग्रहित',
    archivedTitle: 'संग्रहित ग्राहक',
    noArchivedCustomers: 'कोई संग्रहित ग्राहक नहीं।',
    archiveCustomer: 'ग्राहक संग्रह करें',
    archiveCustomerMsg:
      '{name} को संग्रह करें? वे संग्रहित इतिहास में चले जाएंगे (उनकी बही सुरक्षित रहेगी) और बाद में पुनर्स्थापित किए जा सकते हैं।',
    purgeCustomerTitle: 'स्थायी रूप से हटाएं',
    purgeCustomerMsg:
      '{name} को स्थायी रूप से हटाएं? इससे उनकी बही और भुगतान इतिहास भी हट जाएगा और इसे पूर्ववत नहीं किया जा सकता।',
    archivedOn: 'संग्रह दिनांक',

    // Customer form
    editCustomer: 'ग्राहक संपादित करें',
    nameRequired: 'नाम *',
    phoneRequired: 'फ़ोन *',
    phoneInvalid: 'मान्य 10-अंकीय मोबाइल नंबर दर्ज करें।',
    phonePlaceholder: '10-अंकीय नंबर',
    area: 'क्षेत्र',
    areaRequired: 'क्षेत्र *',
    areaPlaceholder: 'क्षेत्र चुनें या नया लिखें',
    saveChanges: 'परिवर्तन सहेजें',
    register: 'पंजीकरण करें',
    saving: 'सहेजा जा रहा है…',

    // Customer detail
    details: 'विवरण',
    balanceTitle: 'शेष राशि',
    totalDebit: 'कुल नामे (प्रभारित)',
    totalCredit: 'कुल जमा (भुगतान)',
    outstanding: 'बकाया',
    overdueLabel: '⚠️ अतिदेय',
    promisedLabel: '⏳ वादा किया',
    promiseBy: '{label}: {amount} — {date} तक',
    addLedgerEntry: 'बही प्रविष्टि जोड़ें',
    editLedgerEntry: 'बही प्रविष्टि संपादित करें',
    uploadPhoto: 'समर्थित फ़ोटो अपलोड करें',
    viewPhoto: 'देखें',
    supportedDocs: 'समर्थित दस्तावेज़',
    closeLabel: 'बंद करें',
    debitOption: 'नामे — ग्राहक प्रभारित',
    creditOption: 'जमा — भुगतान प्राप्त',
    amountField: 'राशि (₹)',
    descOptional: 'विवरण (वैकल्पिक)',
    promisedPaymentDate: 'वादा भुगतान तिथि',
    pendingAmountField: 'लंबित राशि (₹)',
    savePromise: 'वादा सहेजें',
    noOutstandingPromise: 'कोई बकाया राशि नहीं — वादा करने के लिए कुछ नहीं।',
    ledgerHistory: 'बही इतिहास',
    noTransactions: 'अभी तक कोई लेनदेन नहीं।',
    credit: 'जमा',
    debit: 'नामे',

    // Money badge
    owes: 'बकाया',
    advance: 'अग्रिम',
    settled: 'निपटान',

    // Notifications
    recheckNow: 'अभी पुनः जांचें',
    notifIntro:
      'जिन ग्राहकों ने वादा तिथि तक अपना लंबित भुगतान नहीं चुकाया। विवरण देखें, फिर बकाया चुकाने पर चर्चा के लिए उन्हें कॉल करें।',
    noOverdueNow: '🎉 अभी कोई अतिदेय भुगतान नहीं।',
    daysOverdue: '{n} दिन अतिदेय',
    pending: 'लंबित',
    promisedDate: 'वादा तिथि',
    callPhone: '📞 कॉल करें {phone}',
    openProfile: 'प्रोफ़ाइल खोलें',
    markAsPaid: 'भुगतान चिह्नित करें',
    paymentSummary: 'भुगतान सारांश',
    promisedAmount: 'वादा की गई राशि',
    amountReceived: 'प्राप्त राशि',
    newPromisedDate: 'नई वादा तिथि',
    amountInvalid: 'मान्य राशि दर्ज करें।',
    afterUpdate: 'अपडेट के बाद',
    paidNow: 'अभी भुगतान',
    remaining: 'शेष',
    willSettle: 'निपटाया जाएगा और हटाया जाएगा',
    update: 'अपडेट करें'
  }
}

function interpolate(str, vars) {
  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`))
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'hi' || saved === 'en' ? saved : 'en'
  })

  const setLang = useCallback((next) => {
    setLangState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next = prev === 'en' ? 'hi' : 'en'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  const t = useCallback(
    (key, vars) => {
      const table = dict[lang] || dict.en
      const str = table[key] ?? dict.en[key] ?? key
      return interpolate(str, vars)
    },
    [lang]
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}
