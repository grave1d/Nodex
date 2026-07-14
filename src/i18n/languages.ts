export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh-CN', name: '中文' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'ar', name: 'العربية' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'pt-BR', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ur', name: 'اردو' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ja', name: '日本語' },
  { code: 'it', name: 'Italiano' },
  { code: 'uk', name: 'Українська' },
  { code: 'pl', name: 'Polski' },
  { code: 'sr', name: 'Српски' },
] as const;

export type UiLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const LANGUAGE_CODES = new Set<string>(SUPPORTED_LANGUAGES.map(({ code }) => code));

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === 'string' && LANGUAGE_CODES.has(value);
}

export function languageName(language: UiLanguage): string {
  return SUPPORTED_LANGUAGES.find(({ code }) => code === language)?.name ?? language;
}

export function nextUiLanguage(language: UiLanguage): UiLanguage {
  const index = SUPPORTED_LANGUAGES.findIndex(({ code }) => code === language);
  return SUPPORTED_LANGUAGES[(index + 1) % SUPPORTED_LANGUAGES.length]?.code ?? 'en';
}
