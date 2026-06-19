export type Language = 'en' | 'ta' | 'hi';

export const translations = {
    en: {
        // Login
        'login.title': 'Mano Innovation Club',
        'login.subtitle': 'Sign in to continue',
        'login.employee': 'Employee',
        'login.admin': 'Admin',
        'login.emp_id_label': 'Employee ID or Barcode',
        'login.emp_id_placeholder': 'Enter ID, barcode, or name',
        'login.password_label': 'Password',
        'login.password_placeholder': 'Enter password',
        'login.admin_user_label': 'Admin Username',
        'login.admin_user_placeholder': 'Enter admin username',
        'login.signin_button': 'Sign In',
        'login.signing_in': 'Signing in...',
        'login.demo_credentials': 'Demo Credentials:',
        'login.invalid_admin': 'Invalid admin credentials. Try: admin / admin123',
        'login.invalid_employee': 'Invalid employee credentials. Try: EMP001 or Rahul Kumar / emp123',

        // Header
        'header.admin_dashboard': 'Admin Dashboard',
        'header.billing_counter': 'Billing Counter',
        'header.online': 'Online',
        'header.offline': 'Offline',
        'header.pending_sync': 'pending',

        // Navigation
        'nav.billing': 'Billing',
        'nav.products': 'Products',
        'nav.customers': 'Customers',
        'nav.bills': 'Bills',
        'nav.dues': 'Pending Dues',
        'nav.reports': 'Reports',
        'nav.settings': 'Settings',

        // General
        'common.logout': 'Logout',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.add': 'Add',
        'common.delete': 'Delete',
        'common.search': 'Search',
        'common.loading': 'Loading...',
    },
    ta: {
        // Login
        'login.title': 'மனோ இன்னோவேஷன் கிளப்',
        'login.subtitle': 'தொடர உள்நுழையவும்',
        'login.employee': 'ஊழியர்',
        'login.admin': 'நிர்வாகி',
        'login.emp_id_label': 'ஊழியர் ஐடி அல்லது பார்கோடு',
        'login.emp_id_placeholder': 'ஐடி, பார்கோடு அல்லது பெயரை உள்ளிடவும்',
        'login.password_label': 'கடவுச்சொல்',
        'login.password_placeholder': 'கடவுச்சொல்லை உள்ளிடவும்',
        'login.admin_user_label': 'நிர்வாகி பயனர் பெயர்',
        'login.admin_user_placeholder': 'நிர்வாகி பயனர் பெயரை உள்ளிடவும்',
        'login.signin_button': 'உள்நுழைக',
        'login.signing_in': 'உள்நுழைகிறது...',
        'login.demo_credentials': 'டெமோ சான்றுகள்:',
        'login.invalid_admin': 'தவறான நிர்வாகி சான்றுகள். முயற்சி செய்க: admin / admin123',
        'login.invalid_employee': 'தவறான ஊழியர் சான்றுகள். முயற்சி செய்க: EMP001 அல்லது Rahul Kumar / emp123',

        // Header
        'header.admin_dashboard': 'நிர்வாக டாஷ்போர்டு',
        'header.billing_counter': 'பில்லிங் கவுண்டர்',
        'header.online': 'இணையத்தில்',
        'header.offline': 'இணையம் இல்லை',
        'header.pending_sync': 'நிலुவையில் உள்ளது',

        // Navigation
        'nav.billing': 'பில்லிங்',
        'nav.products': 'தயாரிப்புகள்',
        'nav.customers': 'வாடிக்கையாளர்கள்',
        'nav.bills': 'பில்கள்',
        'nav.dues': 'நிலுவைத் தொகைகள்',
        'nav.reports': 'அறிக்கைகள்',
        'nav.settings': 'அமைப்புகள்',

        // General
        'common.logout': 'வெளியேறு',
        'common.save': 'சேமி',
        'common.cancel': 'ரத்து செய்',
        'common.add': 'சேர்',
        'common.delete': 'நீக்கு',
        'common.search': 'தேடு',
        'common.loading': 'ஏற்றப்படுகிறது...',
    },
    hi: {
        // Login
        'login.title': 'मनो इनोवेशन क्लब',
        'login.subtitle': 'जारी रखने के लिए साइन इन करें',
        'login.employee': 'कर्मचारी',
        'login.admin': 'एडमिन',
        'login.emp_id_label': 'कर्मचारी आईडी या बारकोड',
        'login.emp_id_placeholder': 'आईडी, बारकोड या नाम दर्ज करें',
        'login.password_label': 'पासवर्ड',
        'login.password_placeholder': 'पासवर्ड दर्ज करें',
        'login.admin_user_label': 'एडमिन उपयोगकर्ता नाम',
        'login.admin_user_placeholder': 'एडमिन उपयोगकर्ता नाम दर्ज करें',
        'login.signin_button': 'साइन इन करें',
        'login.signing_in': 'साइन इन हो रहा है...',
        'login.demo_credentials': 'डेमो क्रेडेंशियल:',
        'login.invalid_admin': 'अमान्य एडमिन क्रेडेंशियल। कोशिश करें: admin / admin123',
        'login.invalid_employee': 'अमान्य कर्मचारी क्रेडेंशियल। कोशिश करें: EMP001 या Rahul Kumar / emp123',

        // Header
        'header.admin_dashboard': 'एडमिन डैशबोर्ड',
        'header.billing_counter': 'बिलिंग काउंटर',
        'header.online': 'ऑनलाइन',
        'header.offline': 'ऑफलाइन',
        'header.pending_sync': 'लंबित',

        // Navigation
        'nav.billing': 'बिलिंग',
        'nav.products': 'उत्पाद',
        'nav.customers': 'ग्राहक',
        'nav.bills': 'बिल',
        'nav.dues': 'बकाया राशि',
        'nav.reports': 'रिपोर्ट',
        'nav.settings': 'सेटिंग्स',

        // General
        'common.logout': 'लॉगआउट',
        'common.save': 'सहजें',
        'common.cancel': 'रद्द करें',
        'common.add': 'जोड़ें',
        'common.delete': 'हटाएं',
        'common.search': 'खोजें',
        'common.loading': 'लोड हो रहा है...',
    }
};

export type TranslationKey = keyof typeof translations.en;
