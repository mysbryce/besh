import en from './en'
import type { Language } from '../i18n'

type Dictionary = Record<string, string>

export const messagesByLanguage: Partial<Record<Language, Dictionary>> & {
  en: Dictionary
} = { en }

const loaders = {
  th: () => import('./th'),
  zh: () => import('./zh'),
  ru: () => import('./ru'),
  ja: () => import('./ja'),
  ko: () => import('./ko'),
  pt: () => import('./pt'),
}

export async function loadMessages(language: Language) {
  if (language === 'en' || messagesByLanguage[language]) return
  messagesByLanguage[language] = (await loaders[language]()).default
}
