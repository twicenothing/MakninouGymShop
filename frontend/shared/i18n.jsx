import { createContext, useContext, useEffect, useState } from 'react';
import { translations } from './translations';
import { Globe2, ChevronDown } from 'lucide-react';

const storageKey = 'makninou-language';
export function getLanguage() {
  try { return localStorage.getItem(storageKey) === 'ar' ? 'ar' : 'fr'; }
  catch { return 'fr'; }
}
export const localeFor = language => language === 'ar' ? 'ar-DZ' : 'fr-DZ';
export function translate(key, values = {}, language = 'fr') {
  if (key && typeof key === 'object') return translate(key.key, key.values, language);
  const text = translations[key]?.[language] ?? key ?? '';
  return text.replace(/\{(\d+)\}/g, (match, index) => String(values[index] ?? match));
}
const LanguageContext = createContext(null);
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = translate(document.querySelector('meta[name="robots"]') ? 'Admin title' : 'Store title', {}, language);
    try { localStorage.setItem(storageKey, language); } catch { /* Language remains usable for this visit. */ }
  }, [language]);
  const locale = localeFor(language);
  const t = (key, values) => translate(key, values, language);
  const money = value => new Intl.NumberFormat(locale, { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(value || 0);
  return <LanguageContext.Provider value={{ language, setLanguage, locale, t, money }}>{children}</LanguageContext.Provider>;
}
export const useI18n = () => useContext(LanguageContext);
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();
  return <label className="language-switcher"><Globe2 className="language-icon" size={16} aria-hidden="true"/><span className="language-label">{t('Language')}</span><select aria-label={t('Language')} value={language} onChange={event => setLanguage(event.target.value)}>
    <option value="fr" lang="fr">Français</option><option value="ar" lang="ar">العربية</option>
  </select><ChevronDown className="language-chevron" size={15} aria-hidden="true"/></label>;
}
