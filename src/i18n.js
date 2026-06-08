import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import common from './locales/en/common.json'
import onboarding from './locales/en/onboarding.json'
import milestone from './locales/en/milestone.json'
import chapter from './locales/en/chapter.json'
import settings from './locales/en/settings.json'
import sync from './locales/en/sync.json'
import timeline from './locales/en/timeline.json'
import search from './locales/en/search.json'
import help from './locales/en/help.json'
import stats from './locales/en/stats.json'
import importNs from './locales/en/import.json'
import dayglance from './locales/en/dayglance.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: [
      'common',
      'onboarding',
      'milestone',
      'chapter',
      'settings',
      'sync',
      'timeline',
      'search',
      'help',
      'stats',
      'import',
      'dayglance',
    ],
    resources: {
      en: {
        common,
        onboarding,
        milestone,
        chapter,
        settings,
        sync,
        timeline,
        search,
        help,
        stats,
        import: importNs,
        dayglance,
      },
    },
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
