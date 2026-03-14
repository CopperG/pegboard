import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import all locale files
import zhCommon from './locales/zh-CN/common.json'
import zhChat from './locales/zh-CN/chat.json'
import zhPanels from './locales/zh-CN/panels.json'
import zhSidebar from './locales/zh-CN/sidebar.json'
import zhCanvas from './locales/zh-CN/canvas.json'
import zhSettings from './locales/zh-CN/settings.json'
import enCommon from './locales/en/common.json'
import enChat from './locales/en/chat.json'
import enPanels from './locales/en/panels.json'
import enSidebar from './locales/en/sidebar.json'
import enCanvas from './locales/en/canvas.json'
import enSettings from './locales/en/settings.json'

i18n.use(LanguageDetector).use(initReactI18next).init({
  fallbackLng: 'zh-CN',
  defaultNS: 'common',
  ns: ['common', 'chat', 'panels', 'sidebar', 'canvas', 'settings'],
  interpolation: { escapeValue: false },
  detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  resources: {
    'zh-CN': { common: zhCommon, chat: zhChat, panels: zhPanels, sidebar: zhSidebar, canvas: zhCanvas, settings: zhSettings },
    en: { common: enCommon, chat: enChat, panels: enPanels, sidebar: enSidebar, canvas: enCanvas, settings: enSettings },
  },
})

export default i18n
