import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateLanguage } from '../features/user-preference/hooks/useUserPreferenceMutations';

type LanguageContextType = {
  language: string;
  changeLanguage: (lang: string) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState(i18n.language || 'ja');
  const { updateLanguage } = useUpdateLanguage();

  const changeLanguage = (lang: string) => {
    // フロントエンドの言語設定を更新（常に真）
    i18n.changeLanguage(lang);
    setLanguage(lang);
    
    // バックエンドに非同期で同期（エラーが発生しても処理は続行）
    updateLanguage({ language: lang }).catch((error) => {
      console.error('Failed to sync language with backend:', error);
    });
  };

  // コンポーネント初期化時に現在の言語をバックエンドと同期
  useEffect(() => {
    updateLanguage({ language: i18n.language }).catch((error) => {
      console.error('Failed to sync language with backend:', error);
    });
  }, []);

  return (
    <LanguageContext.Provider value={{ language, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
