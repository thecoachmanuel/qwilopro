import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import { getLanguage } from "./helpers/LocalizationHelper";

i18n
  .use(initReactI18next)
  .use(Backend)
  .init({
    lng: getLanguage() || 'en',
    fallbackLng: 'en',
    debug: false,
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    interpolation: {
      escapeValue: false,
    },
  }, () => {
    if (typeof document !== 'undefined' && i18n.dir) {
      document.documentElement.setAttribute('dir', i18n.dir(i18n.language));
    }
  });

export default i18n;
