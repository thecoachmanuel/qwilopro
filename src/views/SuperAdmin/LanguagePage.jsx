import React from 'react';
import Page from "../../components/Page";
import LanguageChanger from "../../components/LanguageChanger";
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

export default function LanguagePage() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <Page>
      <h3 className="text-center mt-4 font-semibold text-foreground">{t('appbar.change_language')}</h3>

      <div className="flex flex-col gap-4 w-full items-center justify-center mt-8">
        <div className={`w-full md:w-96 rounded-3xl border transition-colors ${
          theme === 'black' 
            ? 'border-restro-border-dark-mode bg-restro-bg-card-dark-mode text-restro-text-dark-mode' 
            : 'border-restro-green-light bg-background text-foreground'
        }`}>
          <div className="px-4 py-3">
            <label className="block mb-2 text-sm font-medium">{t('appbar.select_language')}</label>
            <LanguageChanger className={`rounded-full px-3 py-2 transition active:scale-95 w-full border ${
              theme === 'black'
                ? 'border-restro-border-dark-mode bg-restro-bg-seconday-dark-mode text-neutral-100 hover:bg-restro-bg-hover-dark-mode'
                : 'border-restro-green-light bg-restro-gray text-gray-700 hover:bg-restro-button-hover'
            }`} />
          </div>
        </div>
      </div>
    </Page>
  );
}