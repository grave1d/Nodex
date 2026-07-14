import type { ConsoleLanguage } from '../console/dashboard.js';

export type SetupLanguage = ConsoleLanguage;

export type SetupAction =
  | 'connect'
  | 'select-agent'
  | 'api-key'
  | 'verify'
  | 'prepare-agent'
  | 'start-server'
  | 'doctor'
  | 'language'
  | 'documentation'
  | 'exit';

export interface SetupCopy {
  tagline: string;
  version: string;
  license: string;
  privateApiWarning: string;
  mainMenu: string;
  menu: Record<SetupAction, string>;
  back: string;
  continue: string;
  yes: string;
  no: string;
  selected: string;
  current: string;
  connectFirst: string;
  openingNotion: string;
  checkingSession: string;
  waitingForSignIn: string;
  findingAgents: string;
  connected: string;
  credentialsSaved: string;
  authFailed: string;
  manualAuth: string;
  troubleshooting: string;
  agentsTitle: string;
  noAgents: string;
  noAgentAccess: string;
  retry: string;
  createAgent: string;
  manualFallback: string;
  configCreate: string;
  configUpdate: string;
  configUnchanged: string;
  configConfirm: string;
  configSaved: string;
  backupSaved: string;
  apiKeyCreated: string;
  apiKeyExists: string;
  apiKeyMasked: string;
  gitignoreConfirm: string;
  gitignoreUpdated: string;
  codexSnippet: string;
  nextStep: string;
  verifySafeOk: string;
  modelSyncMatches: string;
  modelSyncPending: string;
  modelSyncNotRequired: string;
  verifyMissing: string;
  liveTestQuestion: string;
  liveTestWarning: string;
  liveTestOk: string;
  prepareTitle: string;
  prepareNotRequired: string;
  doctorTitle: string;
  docsOpened: string;
  goodbye: string;
  cancelled: string;
  errorTitle: string;
  workspace: string;
  account: string;
  model: string;
}

export const SETUP_COPY: Record<SetupLanguage, SetupCopy> = {
  en: {
    tagline: 'Your Notion Agent. Available anywhere OpenAI models work.',
    version: 'Version',
    license: 'Apache-2.0 license',
    privateApiWarning: 'Important: Nodex uses an unofficial private Notion API that may change.',
    mainMenu: 'Set up Nodex',
    menu: {
      connect: 'Connect Notion',
      'select-agent': 'Select Custom Agent',
      'api-key': 'Get API-Key',
      verify: 'Verify connection',
      'prepare-agent': 'Prepare Agent for Codex',
      'start-server': 'Start server',
      doctor: 'Doctor',
      language: 'Change language',
      documentation: 'Open documentation',
      exit: 'Exit',
    },
    back: 'Back',
    continue: 'Continue',
    yes: 'Yes',
    no: 'No',
    selected: 'selected',
    current: 'current',
    connectFirst: 'Connect Notion first, then choose your agent.',
    openingNotion: 'Opening Notion in the private Nodex browser profile…',
    checkingSession: 'Checking the saved Nodex session…',
    waitingForSignIn: 'Waiting for sign-in… Complete it in the visible browser window.',
    findingAgents: 'Finding your Custom Agents…',
    connected: 'Notion connected.',
    credentialsSaved: 'Credentials: saved locally and masked',
    authFailed: 'Notion sign-in could not be completed.',
    manualAuth: 'Use manual token mode',
    troubleshooting: 'Open troubleshooting',
    agentsTitle: 'Choose your Custom Agent',
    noAgents: 'No accessible Custom Agents were found.',
    noAgentAccess: 'Create a Custom Agent in Notion or ask the workspace owner for access.',
    retry: 'Retry',
    createAgent: 'Open Notion agents',
    manualFallback: 'Open manual ID fallback',
    configCreate: 'A new nodex.config.json will be created.',
    configUpdate: 'Existing configuration changes:',
    configUnchanged: 'The selected agent is already configured.',
    configConfirm: 'Apply these configuration changes?',
    configSaved: 'Configuration saved.',
    backupSaved: 'Backup saved',
    apiKeyCreated: 'A strong local API key was created and saved to .env.',
    apiKeyExists: 'The existing local API key will be reused.',
    apiKeyMasked: 'API key',
    gitignoreConfirm: 'Add missing Nodex security entries to .gitignore?',
    gitignoreUpdated: '.gitignore updated.',
    codexSnippet: 'Add this provider to your user-level Codex config:',
    nextStep: 'Next step',
    verifySafeOk: 'Agent preflight and discovery passed. No message was sent.',
    modelSyncMatches: 'Notion model already matches the configured model.',
    modelSyncPending: 'The configured model will be synchronized on the next inference.',
    modelSyncNotRequired: 'No Notion model change is required.',
    verifyMissing: 'The configured agent is not accessible in the current Notion workspace.',
    liveTestQuestion: 'Run an explicit live test now?',
    liveTestWarning: 'This creates a Notion thread and may use Notion AI quota.',
    liveTestOk: 'Live connection test completed.',
    prepareTitle: 'Prepare Agent for Codex',
    prepareNotRequired: 'No agent changes are required. Nodex handles the integration layer locally.',
    doctorTitle: 'Doctor results',
    docsOpened: 'Documentation opened in your browser.',
    goodbye: 'Nodex setup closed.',
    cancelled: 'Setup cancelled safely.',
    errorTitle: 'Could not complete this step',
    workspace: 'Workspace',
    account: 'Account',
    model: 'Model',
  },
  ru: {
    tagline: 'Ваш Notion-агент — везде, где работают OpenAI-модели.',
    version: 'Версия',
    license: 'Лицензия Apache-2.0',
    privateApiWarning: 'Важно: Nodex использует неофициальный приватный API Notion, который может измениться.',
    mainMenu: 'Настройка Nodex',
    menu: {
      connect: 'Подключить Notion',
      'select-agent': 'Выбрать Custom Agent',
      'api-key': 'Получить API-ключ',
      verify: 'Проверить подключение',
      'prepare-agent': 'Подготовить агента для Codex',
      'start-server': 'Запустить сервер',
      doctor: 'Диагностика',
      language: 'Сменить язык',
      documentation: 'Открыть документацию',
      exit: 'Выйти',
    },
    back: 'Назад',
    continue: 'Продолжить',
    yes: 'Да',
    no: 'Нет',
    selected: 'выбран',
    current: 'текущий',
    connectFirst: 'Сначала подключите Notion, затем выберите агента.',
    openingNotion: 'Открываю Notion в отдельном профиле браузера Nodex…',
    checkingSession: 'Проверяю сохранённую сессию Nodex…',
    waitingForSignIn: 'Жду входа… Завершите авторизацию в видимом окне браузера.',
    findingAgents: 'Ищу ваши Custom Agents…',
    connected: 'Notion подключён.',
    credentialsSaved: 'Учётные данные: сохранены локально и скрыты',
    authFailed: 'Не удалось завершить вход в Notion.',
    manualAuth: 'Использовать ручной ввод токенов',
    troubleshooting: 'Открыть решение проблем',
    agentsTitle: 'Выберите Custom Agent',
    noAgents: 'Доступные Custom Agents не найдены.',
    noAgentAccess: 'Создайте Custom Agent в Notion или запросите доступ у владельца workspace.',
    retry: 'Повторить',
    createAgent: 'Открыть агентов Notion',
    manualFallback: 'Открыть инструкцию по ручному ID',
    configCreate: 'Будет создан новый nodex.config.json.',
    configUpdate: 'Изменения существующей конфигурации:',
    configUnchanged: 'Выбранный агент уже настроен.',
    configConfirm: 'Применить эти изменения конфигурации?',
    configSaved: 'Конфигурация сохранена.',
    backupSaved: 'Резервная копия',
    apiKeyCreated: 'Сильный локальный API-ключ создан и сохранён в .env.',
    apiKeyExists: 'Будет использован существующий локальный API-ключ.',
    apiKeyMasked: 'API-ключ',
    gitignoreConfirm: 'Добавить недостающие защитные записи Nodex в .gitignore?',
    gitignoreUpdated: '.gitignore обновлён.',
    codexSnippet: 'Добавьте этот provider в пользовательский конфиг Codex:',
    nextStep: 'Следующий шаг',
    verifySafeOk: 'Preflight и discovery агента прошли. Сообщение агенту не отправлялось.',
    modelSyncMatches: 'Модель Notion уже совпадает с настроенной моделью.',
    modelSyncPending: 'Настроенная модель будет синхронизирована при следующем inference.',
    modelSyncNotRequired: 'Изменять модель Notion не требуется.',
    verifyMissing: 'Настроенный агент недоступен в текущем workspace Notion.',
    liveTestQuestion: 'Запустить явный live-тест?',
    liveTestWarning: 'Он создаст тред Notion и может потратить квоту Notion AI.',
    liveTestOk: 'Live-проверка подключения завершена.',
    prepareTitle: 'Подготовка агента для Codex',
    prepareNotRequired: 'Менять агента не требуется. Nodex управляет интеграционным слоем локально.',
    doctorTitle: 'Результаты диагностики',
    docsOpened: 'Документация открыта в браузере.',
    goodbye: 'Настройка Nodex закрыта.',
    cancelled: 'Настройка безопасно отменена.',
    errorTitle: 'Не удалось завершить шаг',
    workspace: 'Workspace',
    account: 'Аккаунт',
    model: 'Модель',
  },
};

export const NODEX_LOGO = [
  ' _   _           _            ',
  '| \\ | | ___   __| | _____  __',
  '|  \\| |/ _ \\ / _` |/ _ \\ \\/ /',
  '| |\\  | (_) | (_| |  __/>  < ',
  '|_| \\_|\\___/ \\__,_|\\___/_/\\_\\',
];
