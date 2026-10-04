exports.CONFIG = {
    MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/restropro_saas",
    DATABASE_URL: process.env.MONGODB_URI || process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET || "restro_jwt_secret",
    JWT_EXPIRY: process.env.JWT_EXPIRY || "15m",
    JWT_EXPIRY_REFRESH: process.env.JWT_EXPIRY_REFRESH || "30d",
    COOKIE_EXPIRY: process.env.COOKIE_EXPIRY || 300000,
    COOKIE_EXPIRY_REFRESH: process.env.COOKIE_EXPIRY_REFRESH || 2592000000,
    FRONTEND_DOMAIN: process.env.FRONTEND_DOMAIN || "http://localhost:3000",
    FRONTEND_DOMAIN_COOKIE: process.env.FRONTEND_DOMAIN_COOKIE || "localhost",
    PASSWORD_SALT: parseInt(process.env.PASSWORD_SALT) || 10,
    STRIPE_SECRET: process.env.STRIPE_SECRET,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_EMAIL: process.env.SMTP_EMAIL,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || "uiflow",
    CREDENTIAL_ENCRYPTION_KEY: process.env.CREDENTIAL_ENCRYPTION_KEY || "cb78b647f4d0c4ff64163317440ff83bc14edd17bd92e100aff4a492f1911c0c"
};

exports.LANGUAGES = [
    'ar',
    'en',
    'es',
    'fr',
    'hi',
    'ja',
    'ko'
];
