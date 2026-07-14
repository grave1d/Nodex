import type { UiLanguage } from '../i18n/languages.js';

export type SetupLanguage = UiLanguage;

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
  mainMenu: string;
  menu: Record<SetupAction, string>;
  changeAccount: string;
  back: string;
  continue: string;
  yes: string;
  no: string;
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
  modelsTitle: string;
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
  gitignoreConfirm: string;
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

type SetupCopyOverride = Omit<Partial<SetupCopy>, 'menu'> & {
  menu?: Partial<Record<SetupAction, string>>;
};

const ENGLISH_COPY: SetupCopy = {
  tagline: 'Your Notion Agent. Available anywhere OpenAI models work.',
  version: 'Version',
  license: 'Apache-2.0 license',
  mainMenu: 'Set up Nodex',
  menu: {
    connect: 'Connect Notion',
    'select-agent': 'Choose agent and model',
    'api-key': 'Get API key',
    verify: 'Verify connection',
    'prepare-agent': 'Prepare agent for Codex',
    'start-server': 'Start server',
    doctor: 'Diagnostics',
    language: 'Change language',
    documentation: 'Open documentation',
    exit: 'Exit',
  },
  changeAccount: 'Change Notion account',
  back: 'Back',
  continue: 'Continue',
  yes: 'Yes',
  no: 'No',
  current: 'current',
  connectFirst: 'Connect Notion first, then choose your agent.',
  openingNotion: 'Opening Notion in the private Nodex browser profile…',
  checkingSession: 'Checking the saved Notion session…',
  waitingForSignIn: 'Waiting for sign-in… Complete it in the visible browser window.',
  findingAgents: 'Finding your Custom Agents…',
  connected: 'Notion connected.',
  credentialsSaved: 'Credentials: saved locally and masked',
  authFailed: 'Notion sign-in could not be completed.',
  manualAuth: 'Use manual token mode',
  troubleshooting: 'Open troubleshooting',
  agentsTitle: 'Choose your Custom Agent',
  modelsTitle: 'Choose a model for this agent',
  noAgents: 'No accessible Custom Agents were found.',
  noAgentAccess: 'Create a Custom Agent in Notion or ask the workspace owner for access.',
  retry: 'Retry',
  createAgent: 'Open Notion agents',
  manualFallback: 'Open manual ID fallback',
  configCreate: 'A new nodex.config.json will be created.',
  configUpdate: 'Existing configuration changes:',
  configUnchanged: 'This agent and model are already configured.',
  configConfirm: 'Apply these configuration changes?',
  configSaved: 'Configuration saved.',
  backupSaved: 'Backup saved',
  gitignoreConfirm: 'Add missing Nodex security entries to .gitignore?',
  verifySafeOk: 'Agent preflight and discovery passed. No message was sent.',
  modelSyncMatches: 'Notion model already matches the configured model.',
  modelSyncPending: 'The configured model will be synchronized on the next inference.',
  modelSyncNotRequired: 'No Notion model change is required.',
  verifyMissing: 'The configured agent is not accessible in the current Notion workspace.',
  liveTestQuestion: 'Run an explicit live test now?',
  liveTestWarning: 'This creates a Notion thread and may use Notion AI quota.',
  liveTestOk: 'Live connection test completed.',
  prepareTitle: 'Prepare agent for Codex',
  prepareNotRequired: 'No agent changes are required. Nodex handles the integration layer locally.',
  doctorTitle: 'Diagnostics results',
  docsOpened: 'Documentation opened in your browser.',
  goodbye: 'Nodex setup closed.',
  cancelled: 'Setup cancelled safely.',
  errorTitle: 'Could not complete this step',
  workspace: 'Workspace',
  account: 'Account',
  model: 'Model',
};

function translated(override: SetupCopyOverride): SetupCopy {
  return {
    ...ENGLISH_COPY,
    ...override,
    menu: { ...ENGLISH_COPY.menu, ...override.menu },
  };
}

export const SETUP_COPY: Record<SetupLanguage, SetupCopy> = {
  en: ENGLISH_COPY,
  'zh-CN': translated({
    tagline: '你的 Notion 智能体，可在任何支持 OpenAI 模型的地方使用。',
    version: '版本', license: 'Apache-2.0 许可证', mainMenu: '设置 Nodex',
    menu: {
      connect: '连接 Notion', 'select-agent': '选择智能体和模型', 'api-key': '获取 API 密钥',
      verify: '验证连接', 'prepare-agent': '为 Codex 准备智能体', 'start-server': '启动服务器',
      doctor: '诊断', language: '切换语言', documentation: '打开文档', exit: '退出',
    },
    changeAccount: '更换 Notion 账号', back: '返回', continue: '继续', yes: '是', no: '否', current: '当前',
    connectFirst: '请先连接 Notion，然后选择智能体。',
    openingNotion: '正在 Nodex 专用浏览器配置中打开 Notion…', checkingSession: '正在检查已保存的 Notion 会话…',
    waitingForSignIn: '正在等待登录…请在可见的浏览器窗口中完成登录。', findingAgents: '正在查找你的 Custom Agents…',
    connected: 'Notion 已连接。', credentialsSaved: '凭据：已在本地保存并隐藏', authFailed: '无法完成 Notion 登录。',
    manualAuth: '使用手动令牌模式', troubleshooting: '打开故障排除', agentsTitle: '选择 Custom Agent',
    modelsTitle: '为此智能体选择模型', noAgents: '未找到可访问的 Custom Agents。',
    noAgentAccess: '请在 Notion 中创建 Custom Agent，或向工作区所有者申请访问权限。', retry: '重试',
    createAgent: '打开 Notion 智能体', manualFallback: '打开手动 ID 指南', configCreate: '将创建新的 nodex.config.json。',
    configUpdate: '现有配置更改：', configUnchanged: '此智能体和模型已配置。', configConfirm: '应用这些配置更改吗？',
    configSaved: '配置已保存。', backupSaved: '备份已保存', gitignoreConfirm: '将缺少的 Nodex 安全条目添加到 .gitignore 吗？',
    verifySafeOk: '智能体预检和发现已通过，未发送任何消息。', modelSyncMatches: 'Notion 模型已与配置的模型一致。',
    modelSyncPending: '配置的模型将在下次推理时同步。', modelSyncNotRequired: '无需更改 Notion 模型。',
    verifyMissing: '当前 Notion 工作区无法访问已配置的智能体。', liveTestQuestion: '现在运行显式实时测试吗？',
    liveTestWarning: '这会创建 Notion 线程，并可能使用 Notion AI 配额。', liveTestOk: '实时连接测试已完成。',
    prepareTitle: '为 Codex 准备智能体', prepareNotRequired: '无需更改智能体，Nodex 会在本地处理集成层。',
    doctorTitle: '诊断结果', docsOpened: '文档已在浏览器中打开。', goodbye: 'Nodex 设置已关闭。',
    cancelled: '设置已安全取消。', errorTitle: '无法完成此步骤', workspace: '工作区', account: '账号', model: '模型',
  }),
  hi: translated({
    tagline: 'आपका Notion Agent — जहाँ भी OpenAI मॉडल काम करते हैं।',
    version: 'संस्करण', license: 'Apache-2.0 लाइसेंस', mainMenu: 'Nodex सेट करें',
    menu: {
      connect: 'Notion कनेक्ट करें', 'select-agent': 'एजेंट और मॉडल चुनें', 'api-key': 'API कुंजी प्राप्त करें',
      verify: 'कनेक्शन जाँचें', 'prepare-agent': 'Codex के लिए एजेंट तैयार करें', 'start-server': 'सर्वर शुरू करें',
      doctor: 'निदान', language: 'भाषा बदलें', documentation: 'दस्तावेज़ खोलें', exit: 'बाहर निकलें',
    },
    changeAccount: 'Notion खाता बदलें', back: 'वापस', continue: 'जारी रखें', yes: 'हाँ', no: 'नहीं', current: 'वर्तमान',
    connectFirst: 'पहले Notion कनेक्ट करें, फिर अपना एजेंट चुनें।', openingNotion: 'Nodex की निजी ब्राउज़र प्रोफ़ाइल में Notion खुल रहा है…',
    checkingSession: 'सहेजा गया Notion सत्र जाँचा जा रहा है…', waitingForSignIn: 'साइन-इन की प्रतीक्षा है… दिखाई दे रही ब्राउज़र विंडो में इसे पूरा करें।',
    findingAgents: 'आपके Custom Agents खोजे जा रहे हैं…', connected: 'Notion कनेक्ट हो गया।',
    credentialsSaved: 'क्रेडेंशियल: स्थानीय रूप से सहेजे और छिपाए गए', authFailed: 'Notion साइन-इन पूरा नहीं हो सका।',
    manualAuth: 'मैन्युअल टोकन मोड उपयोग करें', troubleshooting: 'समस्या निवारण खोलें', agentsTitle: 'अपना Custom Agent चुनें',
    modelsTitle: 'इस एजेंट के लिए मॉडल चुनें', noAgents: 'कोई सुलभ Custom Agent नहीं मिला।',
    retry: 'फिर प्रयास करें', createAgent: 'Notion एजेंट खोलें', configSaved: 'कॉन्फ़िगरेशन सहेजा गया।',
    gitignoreConfirm: 'अनुपस्थित Nodex सुरक्षा प्रविष्टियाँ .gitignore में जोड़ें?', doctorTitle: 'निदान परिणाम',
    docsOpened: 'दस्तावेज़ ब्राउज़र में खुल गए।', goodbye: 'Nodex सेटअप बंद हुआ।', errorTitle: 'यह चरण पूरा नहीं हो सका',
    workspace: 'वर्कस्पेस', account: 'खाता', model: 'मॉडल',
  }),
  es: translated({
    tagline: 'Tu agente de Notion, disponible donde funcionen los modelos de OpenAI.',
    version: 'Versión', license: 'Licencia Apache-2.0', mainMenu: 'Configurar Nodex',
    menu: {
      connect: 'Conectar Notion', 'select-agent': 'Elegir agente y modelo', 'api-key': 'Obtener clave API',
      verify: 'Verificar conexión', 'prepare-agent': 'Preparar agente para Codex', 'start-server': 'Iniciar servidor',
      doctor: 'Diagnóstico', language: 'Cambiar idioma', documentation: 'Abrir documentación', exit: 'Salir',
    },
    changeAccount: 'Cambiar cuenta de Notion', back: 'Atrás', continue: 'Continuar', yes: 'Sí', no: 'No', current: 'actual',
    connectFirst: 'Conecta Notion primero y después elige tu agente.', openingNotion: 'Abriendo Notion en el perfil privado de Nodex…',
    checkingSession: 'Comprobando la sesión guardada de Notion…', waitingForSignIn: 'Esperando el inicio de sesión… Complétalo en la ventana visible del navegador.',
    findingAgents: 'Buscando tus Custom Agents…', connected: 'Notion conectado.', credentialsSaved: 'Credenciales: guardadas localmente y ocultas',
    authFailed: 'No se pudo completar el inicio de sesión en Notion.', manualAuth: 'Usar el modo de token manual',
    troubleshooting: 'Abrir solución de problemas', agentsTitle: 'Elige tu Custom Agent', modelsTitle: 'Elige un modelo para este agente',
    noAgents: 'No se encontraron Custom Agents accesibles.', noAgentAccess: 'Crea un Custom Agent en Notion o solicita acceso al propietario del workspace.',
    retry: 'Reintentar', createAgent: 'Abrir agentes de Notion', manualFallback: 'Abrir la guía de ID manual',
    configCreate: 'Se creará un nuevo nodex.config.json.', configUpdate: 'Cambios en la configuración existente:',
    configUnchanged: 'Este agente y modelo ya están configurados.', configConfirm: '¿Aplicar estos cambios de configuración?',
    configSaved: 'Configuración guardada.', backupSaved: 'Copia de seguridad guardada',
    gitignoreConfirm: '¿Añadir a .gitignore las entradas de seguridad de Nodex que faltan?',
    verifySafeOk: 'La comprobación y detección del agente finalizaron correctamente. No se envió ningún mensaje.',
    modelSyncMatches: 'El modelo de Notion ya coincide con el configurado.', modelSyncPending: 'El modelo configurado se sincronizará en la próxima inferencia.',
    modelSyncNotRequired: 'No es necesario cambiar el modelo de Notion.', verifyMissing: 'El agente configurado no está accesible en el workspace actual de Notion.',
    liveTestQuestion: '¿Ejecutar ahora una prueba real explícita?', liveTestWarning: 'Esto crea un hilo de Notion y puede consumir cuota de Notion AI.',
    liveTestOk: 'Prueba de conexión real completada.', prepareTitle: 'Preparar agente para Codex',
    prepareNotRequired: 'No se requieren cambios en el agente. Nodex gestiona la integración localmente.', doctorTitle: 'Resultados del diagnóstico',
    docsOpened: 'La documentación se abrió en el navegador.', goodbye: 'Configuración de Nodex cerrada.', cancelled: 'Configuración cancelada de forma segura.',
    errorTitle: 'No se pudo completar este paso', workspace: 'Espacio de trabajo', account: 'Cuenta', model: 'Modelo',
  }),
  fr: translated({
    tagline: 'Votre agent Notion, disponible partout où les modèles OpenAI fonctionnent.',
    version: 'Version', license: 'Licence Apache-2.0', mainMenu: 'Configurer Nodex',
    menu: {
      connect: 'Connecter Notion', 'select-agent': 'Choisir l’agent et le modèle', 'api-key': 'Obtenir la clé API',
      verify: 'Vérifier la connexion', 'prepare-agent': 'Préparer l’agent pour Codex', 'start-server': 'Démarrer le serveur',
      doctor: 'Diagnostic', language: 'Changer de langue', documentation: 'Ouvrir la documentation', exit: 'Quitter',
    },
    changeAccount: 'Changer de compte Notion', back: 'Retour', continue: 'Continuer', yes: 'Oui', no: 'Non', current: 'actuel',
    connectFirst: 'Connectez d’abord Notion, puis choisissez votre agent.', openingNotion: 'Ouverture de Notion dans le profil privé Nodex…',
    checkingSession: 'Vérification de la session Notion enregistrée…', waitingForSignIn: 'Connexion en attente… Terminez-la dans la fenêtre visible du navigateur.',
    findingAgents: 'Recherche de vos Custom Agents…', connected: 'Notion est connecté.', credentialsSaved: 'Identifiants : enregistrés localement et masqués',
    authFailed: 'La connexion à Notion n’a pas pu aboutir.', manualAuth: 'Utiliser le mode jeton manuel', troubleshooting: 'Ouvrir le dépannage',
    agentsTitle: 'Choisissez votre Custom Agent', modelsTitle: 'Choisissez un modèle pour cet agent', noAgents: 'Aucun Custom Agent accessible n’a été trouvé.',
    retry: 'Réessayer', createAgent: 'Ouvrir les agents Notion', configSaved: 'Configuration enregistrée.',
    gitignoreConfirm: 'Ajouter à .gitignore les entrées de sécurité Nodex manquantes ?', doctorTitle: 'Résultats du diagnostic',
    docsOpened: 'La documentation est ouverte dans le navigateur.', goodbye: 'Configuration de Nodex fermée.',
    errorTitle: 'Impossible de terminer cette étape', workspace: 'Espace de travail', account: 'Compte', model: 'Modèle',
  }),
  ar: translated({
    tagline: 'وكيل Notion الخاص بك، متاح أينما تعمل نماذج OpenAI.',
    version: 'الإصدار', license: 'ترخيص Apache-2.0', mainMenu: 'إعداد Nodex',
    menu: {
      connect: 'ربط Notion', 'select-agent': 'اختيار الوكيل والنموذج', 'api-key': 'الحصول على مفتاح API',
      verify: 'التحقق من الاتصال', 'prepare-agent': 'إعداد الوكيل لـ Codex', 'start-server': 'تشغيل الخادم',
      doctor: 'التشخيص', language: 'تغيير اللغة', documentation: 'فتح الوثائق', exit: 'خروج',
    },
    changeAccount: 'تغيير حساب Notion', back: 'رجوع', continue: 'متابعة', yes: 'نعم', no: 'لا', current: 'الحالي',
    connectFirst: 'اربط Notion أولاً، ثم اختر وكيلك.', openingNotion: 'جارٍ فتح Notion في ملف متصفح Nodex الخاص…',
    checkingSession: 'جارٍ التحقق من جلسة Notion المحفوظة…', waitingForSignIn: 'بانتظار تسجيل الدخول… أكمله في نافذة المتصفح الظاهرة.',
    findingAgents: 'جارٍ البحث عن Custom Agents…', connected: 'تم ربط Notion.', credentialsSaved: 'بيانات الاعتماد: محفوظة محلياً ومخفية',
    authFailed: 'تعذر إكمال تسجيل الدخول إلى Notion.', manualAuth: 'استخدام وضع الرمز اليدوي', troubleshooting: 'فتح استكشاف الأخطاء',
    agentsTitle: 'اختر Custom Agent', modelsTitle: 'اختر نموذجاً لهذا الوكيل', noAgents: 'لم يتم العثور على Custom Agents متاحة.',
    retry: 'إعادة المحاولة', createAgent: 'فتح وكلاء Notion', configSaved: 'تم حفظ الإعدادات.',
    gitignoreConfirm: 'هل تريد إضافة إدخالات أمان Nodex الناقصة إلى ‎.gitignore؟', doctorTitle: 'نتائج التشخيص',
    docsOpened: 'تم فتح الوثائق في المتصفح.', goodbye: 'تم إغلاق إعداد Nodex.', errorTitle: 'تعذر إكمال هذه الخطوة',
    workspace: 'مساحة العمل', account: 'الحساب', model: 'النموذج',
  }),
  bn: translated({
    tagline: 'আপনার Notion Agent—যেখানে OpenAI মডেল কাজ করে সেখানেই উপলভ্য।',
    version: 'সংস্করণ', license: 'Apache-2.0 লাইসেন্স', mainMenu: 'Nodex সেট আপ করুন',
    menu: {
      connect: 'Notion সংযুক্ত করুন', 'select-agent': 'এজেন্ট ও মডেল বেছে নিন', 'api-key': 'API কী নিন',
      verify: 'সংযোগ যাচাই করুন', 'prepare-agent': 'Codex-এর জন্য এজেন্ট প্রস্তুত করুন', 'start-server': 'সার্ভার চালু করুন',
      doctor: 'ডায়াগনস্টিকস', language: 'ভাষা বদলান', documentation: 'ডকুমেন্টেশন খুলুন', exit: 'প্রস্থান',
    },
    changeAccount: 'Notion অ্যাকাউন্ট বদলান', back: 'ফিরুন', continue: 'চালিয়ে যান', yes: 'হ্যাঁ', no: 'না', current: 'বর্তমান',
    connectFirst: 'আগে Notion সংযুক্ত করুন, তারপর এজেন্ট বেছে নিন।', openingNotion: 'Nodex-এর ব্যক্তিগত ব্রাউজার প্রোফাইলে Notion খোলা হচ্ছে…',
    checkingSession: 'সংরক্ষিত Notion সেশন পরীক্ষা করা হচ্ছে…', waitingForSignIn: 'সাইন-ইনের অপেক্ষা… দৃশ্যমান ব্রাউজার উইন্ডোতে সম্পন্ন করুন।',
    findingAgents: 'আপনার Custom Agents খোঁজা হচ্ছে…', connected: 'Notion সংযুক্ত হয়েছে।', agentsTitle: 'আপনার Custom Agent বেছে নিন',
    modelsTitle: 'এই এজেন্টের জন্য মডেল বেছে নিন', noAgents: 'অ্যাক্সেসযোগ্য কোনো Custom Agent পাওয়া যায়নি।', retry: 'আবার চেষ্টা করুন',
    createAgent: 'Notion এজেন্ট খুলুন', configSaved: 'কনফিগারেশন সংরক্ষিত হয়েছে।',
    gitignoreConfirm: 'অনুপস্থিত Nodex নিরাপত্তা এন্ট্রি .gitignore-এ যোগ করবেন?', doctorTitle: 'ডায়াগনস্টিক ফলাফল',
    docsOpened: 'ব্রাউজারে ডকুমেন্টেশন খোলা হয়েছে।', goodbye: 'Nodex সেটআপ বন্ধ হয়েছে।', errorTitle: 'এই ধাপ সম্পন্ন করা যায়নি',
    workspace: 'ওয়ার্কস্পেস', account: 'অ্যাকাউন্ট', model: 'মডেল',
  }),
  'pt-BR': translated({
    tagline: 'Seu agente do Notion, disponível onde os modelos da OpenAI funcionarem.',
    version: 'Versão', license: 'Licença Apache-2.0', mainMenu: 'Configurar o Nodex',
    menu: {
      connect: 'Conectar o Notion', 'select-agent': 'Escolher agente e modelo', 'api-key': 'Obter chave de API',
      verify: 'Verificar conexão', 'prepare-agent': 'Preparar agente para o Codex', 'start-server': 'Iniciar servidor',
      doctor: 'Diagnóstico', language: 'Mudar idioma', documentation: 'Abrir documentação', exit: 'Sair',
    },
    changeAccount: 'Trocar conta do Notion', back: 'Voltar', continue: 'Continuar', yes: 'Sim', no: 'Não', current: 'atual',
    connectFirst: 'Conecte o Notion primeiro e depois escolha seu agente.', openingNotion: 'Abrindo o Notion no perfil privado do Nodex…',
    checkingSession: 'Verificando a sessão salva do Notion…', waitingForSignIn: 'Aguardando login… Conclua na janela visível do navegador.',
    findingAgents: 'Procurando seus Custom Agents…', connected: 'Notion conectado.', credentialsSaved: 'Credenciais: salvas localmente e ocultas',
    authFailed: 'Não foi possível concluir o login no Notion.', manualAuth: 'Usar modo de token manual', troubleshooting: 'Abrir solução de problemas',
    agentsTitle: 'Escolha seu Custom Agent', modelsTitle: 'Escolha um modelo para este agente', noAgents: 'Nenhum Custom Agent acessível foi encontrado.',
    retry: 'Tentar novamente', createAgent: 'Abrir agentes do Notion', configSaved: 'Configuração salva.',
    gitignoreConfirm: 'Adicionar ao .gitignore as entradas de segurança do Nodex que faltam?', doctorTitle: 'Resultados do diagnóstico',
    docsOpened: 'A documentação foi aberta no navegador.', goodbye: 'Configuração do Nodex encerrada.',
    errorTitle: 'Não foi possível concluir esta etapa', workspace: 'Workspace', account: 'Conta', model: 'Modelo',
  }),
  ru: translated({
    tagline: 'Ваш Notion-агент — везде, где работают OpenAI-модели.',
    version: 'Версия', license: 'Лицензия Apache-2.0', mainMenu: 'Настройка Nodex',
    menu: {
      connect: 'Подключить Notion', 'select-agent': 'Выбрать агента и модель', 'api-key': 'Получить API-ключ',
      verify: 'Проверить подключение', 'prepare-agent': 'Подготовить агента для Codex', 'start-server': 'Запустить сервер',
      doctor: 'Диагностика', language: 'Сменить язык', documentation: 'Открыть документацию', exit: 'Выйти',
    },
    changeAccount: 'Сменить аккаунт Notion', back: 'Назад', continue: 'Продолжить', yes: 'Да', no: 'Нет', current: 'текущая',
    connectFirst: 'Сначала подключите Notion, затем выберите агента.', openingNotion: 'Открываю Notion в отдельном профиле браузера Nodex…',
    checkingSession: 'Проверяю сохранённую сессию Notion…', waitingForSignIn: 'Жду входа… Завершите авторизацию в видимом окне браузера.',
    findingAgents: 'Ищу ваши Custom Agents…', connected: 'Notion подключён.', credentialsSaved: 'Учётные данные: сохранены локально и скрыты',
    authFailed: 'Не удалось завершить вход в Notion.', manualAuth: 'Использовать ручной ввод токенов', troubleshooting: 'Открыть решение проблем',
    agentsTitle: 'Выберите Custom Agent', modelsTitle: 'Выберите модель для агента', noAgents: 'Доступные Custom Agents не найдены.',
    noAgentAccess: 'Создайте Custom Agent в Notion или запросите доступ у владельца workspace.', retry: 'Повторить',
    createAgent: 'Открыть агентов Notion', manualFallback: 'Открыть инструкцию по ручному ID', configCreate: 'Будет создан новый nodex.config.json.',
    configUpdate: 'Изменения существующей конфигурации:', configUnchanged: 'Этот агент и модель уже настроены.',
    configConfirm: 'Применить эти изменения конфигурации?', configSaved: 'Конфигурация сохранена.', backupSaved: 'Резервная копия',
    gitignoreConfirm: 'Добавить недостающие защитные записи Nodex в .gitignore?',
    verifySafeOk: 'Preflight и discovery агента прошли. Сообщение агенту не отправлялось.',
    modelSyncMatches: 'Модель Notion уже совпадает с настроенной моделью.', modelSyncPending: 'Настроенная модель будет синхронизирована при следующем inference.',
    modelSyncNotRequired: 'Изменять модель Notion не требуется.', verifyMissing: 'Настроенный агент недоступен в текущем workspace Notion.',
    liveTestQuestion: 'Запустить явный live-тест?', liveTestWarning: 'Он создаст тред Notion и может потратить квоту Notion AI.',
    liveTestOk: 'Live-проверка подключения завершена.', prepareTitle: 'Подготовка агента для Codex',
    prepareNotRequired: 'Менять агента не требуется. Nodex управляет интеграционным слоем локально.', doctorTitle: 'Результаты диагностики',
    docsOpened: 'Документация открыта в браузере.', goodbye: 'Настройка Nodex закрыта.', cancelled: 'Настройка безопасно отменена.',
    errorTitle: 'Не удалось завершить шаг', workspace: 'Workspace', account: 'Аккаунт', model: 'Модель',
  }),
  ur: translated({
    tagline: 'آپ کا Notion Agent، جہاں OpenAI ماڈلز کام کریں وہاں دستیاب۔',
    version: 'ورژن', license: 'Apache-2.0 لائسنس', mainMenu: 'Nodex سیٹ اپ کریں',
    menu: {
      connect: 'Notion منسلک کریں', 'select-agent': 'ایجنٹ اور ماڈل منتخب کریں', 'api-key': 'API کلید حاصل کریں',
      verify: 'کنکشن کی تصدیق کریں', 'prepare-agent': 'Codex کے لیے ایجنٹ تیار کریں', 'start-server': 'سرور شروع کریں',
      doctor: 'تشخیص', language: 'زبان بدلیں', documentation: 'دستاویزات کھولیں', exit: 'باہر نکلیں',
    },
    changeAccount: 'Notion اکاؤنٹ بدلیں', back: 'واپس', continue: 'جاری رکھیں', yes: 'ہاں', no: 'نہیں', current: 'موجودہ',
    connectFirst: 'پہلے Notion منسلک کریں، پھر اپنا ایجنٹ منتخب کریں۔', openingNotion: 'Nodex کے نجی براؤزر پروفائل میں Notion کھولا جا رہا ہے…',
    checkingSession: 'محفوظ شدہ Notion سیشن چیک کیا جا رہا ہے…', waitingForSignIn: 'سائن اِن کا انتظار ہے… نظر آنے والی براؤزر ونڈو میں مکمل کریں۔',
    findingAgents: 'آپ کے Custom Agents تلاش کیے جا رہے ہیں…', connected: 'Notion منسلک ہو گیا۔', agentsTitle: 'اپنا Custom Agent منتخب کریں',
    modelsTitle: 'اس ایجنٹ کے لیے ماڈل منتخب کریں', noAgents: 'کوئی قابل رسائی Custom Agent نہیں ملا۔', retry: 'دوبارہ کوشش کریں',
    createAgent: 'Notion ایجنٹس کھولیں', configSaved: 'کنفیگریشن محفوظ ہو گئی۔',
    gitignoreConfirm: 'کیا Nodex کی غائب سکیورٹی اندراجات .gitignore میں شامل کریں؟', doctorTitle: 'تشخیصی نتائج',
    docsOpened: 'دستاویزات براؤزر میں کھل گئیں۔', goodbye: 'Nodex سیٹ اپ بند ہو گیا۔', errorTitle: 'یہ مرحلہ مکمل نہیں ہو سکا',
    workspace: 'ورک اسپیس', account: 'اکاؤنٹ', model: 'ماڈل',
  }),
  de: translated({
    tagline: 'Dein Notion-Agent – überall verfügbar, wo OpenAI-Modelle funktionieren.',
    version: 'Version', license: 'Apache-2.0-Lizenz', mainMenu: 'Nodex einrichten',
    menu: {
      connect: 'Notion verbinden', 'select-agent': 'Agent und Modell wählen', 'api-key': 'API-Schlüssel erhalten',
      verify: 'Verbindung prüfen', 'prepare-agent': 'Agent für Codex vorbereiten', 'start-server': 'Server starten',
      doctor: 'Diagnose', language: 'Sprache ändern', documentation: 'Dokumentation öffnen', exit: 'Beenden',
    },
    changeAccount: 'Notion-Konto wechseln', back: 'Zurück', continue: 'Weiter', yes: 'Ja', no: 'Nein', current: 'aktuell',
    connectFirst: 'Verbinde zuerst Notion und wähle dann deinen Agenten.', openingNotion: 'Notion wird im privaten Nodex-Browserprofil geöffnet…',
    checkingSession: 'Gespeicherte Notion-Sitzung wird geprüft…', waitingForSignIn: 'Anmeldung ausstehend… Schließe sie im sichtbaren Browserfenster ab.',
    findingAgents: 'Deine Custom Agents werden gesucht…', connected: 'Notion ist verbunden.', credentialsSaved: 'Anmeldedaten: lokal gespeichert und maskiert',
    authFailed: 'Die Notion-Anmeldung konnte nicht abgeschlossen werden.', manualAuth: 'Manuellen Token-Modus verwenden', troubleshooting: 'Fehlerbehebung öffnen',
    agentsTitle: 'Custom Agent auswählen', modelsTitle: 'Modell für diesen Agenten auswählen', noAgents: 'Keine zugänglichen Custom Agents gefunden.',
    retry: 'Erneut versuchen', createAgent: 'Notion-Agenten öffnen', configSaved: 'Konfiguration gespeichert.',
    gitignoreConfirm: 'Fehlende Nodex-Sicherheitseinträge zu .gitignore hinzufügen?', doctorTitle: 'Diagnoseergebnisse',
    docsOpened: 'Die Dokumentation wurde im Browser geöffnet.', goodbye: 'Nodex-Einrichtung geschlossen.',
    errorTitle: 'Dieser Schritt konnte nicht abgeschlossen werden', workspace: 'Workspace', account: 'Konto', model: 'Modell',
  }),
  ja: translated({
    tagline: 'あなたの Notion Agent を、OpenAI モデルが使えるあらゆる場所で。',
    version: 'バージョン', license: 'Apache-2.0 ライセンス', mainMenu: 'Nodex のセットアップ',
    menu: {
      connect: 'Notion に接続', 'select-agent': 'エージェントとモデルを選択', 'api-key': 'API キーを取得',
      verify: '接続を確認', 'prepare-agent': 'Codex 用にエージェントを準備', 'start-server': 'サーバーを起動',
      doctor: '診断', language: '言語を変更', documentation: 'ドキュメントを開く', exit: '終了',
    },
    changeAccount: 'Notion アカウントを変更', back: '戻る', continue: '続行', yes: 'はい', no: 'いいえ', current: '現在',
    connectFirst: '先に Notion に接続してから、エージェントを選択してください。', openingNotion: 'Nodex 専用ブラウザープロファイルで Notion を開いています…',
    checkingSession: '保存済みの Notion セッションを確認しています…', waitingForSignIn: 'サインインを待っています… 表示されたブラウザーで完了してください。',
    findingAgents: 'Custom Agents を検索しています…', connected: 'Notion に接続しました。', credentialsSaved: '認証情報：ローカルに保存し非表示',
    authFailed: 'Notion へのサインインを完了できませんでした。', manualAuth: '手動トークンモードを使う', troubleshooting: 'トラブルシューティングを開く',
    agentsTitle: 'Custom Agent を選択', modelsTitle: 'このエージェントのモデルを選択', noAgents: 'アクセス可能な Custom Agent が見つかりません。',
    retry: '再試行', createAgent: 'Notion エージェントを開く', configSaved: '設定を保存しました。',
    gitignoreConfirm: '不足している Nodex のセキュリティ項目を .gitignore に追加しますか？', doctorTitle: '診断結果',
    docsOpened: 'ブラウザーでドキュメントを開きました。', goodbye: 'Nodex セットアップを終了しました。',
    errorTitle: 'この手順を完了できませんでした', workspace: 'ワークスペース', account: 'アカウント', model: 'モデル',
  }),
  it: translated({
    tagline: 'Il tuo agente Notion, disponibile ovunque funzionino i modelli OpenAI.',
    version: 'Versione', license: 'Licenza Apache-2.0', mainMenu: 'Configura Nodex',
    menu: {
      connect: 'Connetti Notion', 'select-agent': 'Scegli agente e modello', 'api-key': 'Ottieni chiave API',
      verify: 'Verifica connessione', 'prepare-agent': 'Prepara agente per Codex', 'start-server': 'Avvia server',
      doctor: 'Diagnostica', language: 'Cambia lingua', documentation: 'Apri documentazione', exit: 'Esci',
    },
    changeAccount: 'Cambia account Notion', back: 'Indietro', continue: 'Continua', yes: 'Sì', no: 'No', current: 'attuale',
    connectFirst: 'Connetti prima Notion, poi scegli il tuo agente.', openingNotion: 'Apertura di Notion nel profilo privato di Nodex…',
    checkingSession: 'Verifica della sessione Notion salvata…', waitingForSignIn: 'In attesa dell’accesso… Completalo nella finestra visibile del browser.',
    findingAgents: 'Ricerca dei tuoi Custom Agents…', connected: 'Notion connesso.', credentialsSaved: 'Credenziali: salvate localmente e nascoste',
    authFailed: 'Impossibile completare l’accesso a Notion.', manualAuth: 'Usa modalità token manuale', troubleshooting: 'Apri risoluzione problemi',
    agentsTitle: 'Scegli il tuo Custom Agent', modelsTitle: 'Scegli un modello per questo agente', noAgents: 'Nessun Custom Agent accessibile trovato.',
    retry: 'Riprova', createAgent: 'Apri agenti Notion', configSaved: 'Configurazione salvata.',
    gitignoreConfirm: 'Aggiungere a .gitignore le voci di sicurezza Nodex mancanti?', doctorTitle: 'Risultati diagnostici',
    docsOpened: 'Documentazione aperta nel browser.', goodbye: 'Configurazione di Nodex chiusa.',
    errorTitle: 'Impossibile completare questo passaggio', workspace: 'Workspace', account: 'Account', model: 'Modello',
  }),
  uk: translated({
    tagline: 'Ваш Notion-агент — усюди, де працюють моделі OpenAI.',
    version: 'Версія', license: 'Ліцензія Apache-2.0', mainMenu: 'Налаштування Nodex',
    menu: {
      connect: 'Підключити Notion', 'select-agent': 'Вибрати агента й модель', 'api-key': 'Отримати API-ключ',
      verify: 'Перевірити підключення', 'prepare-agent': 'Підготувати агента для Codex', 'start-server': 'Запустити сервер',
      doctor: 'Діагностика', language: 'Змінити мову', documentation: 'Відкрити документацію', exit: 'Вийти',
    },
    changeAccount: 'Змінити акаунт Notion', back: 'Назад', continue: 'Продовжити', yes: 'Так', no: 'Ні', current: 'поточна',
    connectFirst: 'Спочатку підключіть Notion, потім виберіть агента.', openingNotion: 'Відкриваю Notion в окремому профілі браузера Nodex…',
    checkingSession: 'Перевіряю збережену сесію Notion…', waitingForSignIn: 'Очікую на вхід… Завершіть авторизацію у видимому вікні браузера.',
    findingAgents: 'Шукаю ваші Custom Agents…', connected: 'Notion підключено.', credentialsSaved: 'Облікові дані: збережені локально й приховані',
    authFailed: 'Не вдалося завершити вхід до Notion.', manualAuth: 'Ввести токени вручну', troubleshooting: 'Відкрити усунення проблем',
    agentsTitle: 'Виберіть Custom Agent', modelsTitle: 'Виберіть модель для агента', noAgents: 'Доступних Custom Agents не знайдено.',
    retry: 'Повторити', createAgent: 'Відкрити агентів Notion', configSaved: 'Конфігурацію збережено.',
    gitignoreConfirm: 'Додати відсутні захисні записи Nodex до .gitignore?', doctorTitle: 'Результати діагностики',
    docsOpened: 'Документацію відкрито в браузері.', goodbye: 'Налаштування Nodex закрито.',
    errorTitle: 'Не вдалося завершити цей крок', workspace: 'Робочий простір', account: 'Акаунт', model: 'Модель',
  }),
  pl: translated({
    tagline: 'Twój agent Notion — wszędzie tam, gdzie działają modele OpenAI.',
    version: 'Wersja', license: 'Licencja Apache-2.0', mainMenu: 'Konfiguracja Nodex',
    menu: {
      connect: 'Połącz Notion', 'select-agent': 'Wybierz agenta i model', 'api-key': 'Pobierz klucz API',
      verify: 'Sprawdź połączenie', 'prepare-agent': 'Przygotuj agenta dla Codex', 'start-server': 'Uruchom serwer',
      doctor: 'Diagnostyka', language: 'Zmień język', documentation: 'Otwórz dokumentację', exit: 'Wyjdź',
    },
    changeAccount: 'Zmień konto Notion', back: 'Wstecz', continue: 'Kontynuuj', yes: 'Tak', no: 'Nie', current: 'bieżący',
    connectFirst: 'Najpierw połącz Notion, a następnie wybierz agenta.', openingNotion: 'Otwieranie Notion w prywatnym profilu przeglądarki Nodex…',
    checkingSession: 'Sprawdzanie zapisanej sesji Notion…', waitingForSignIn: 'Oczekiwanie na logowanie… Dokończ je w widocznym oknie przeglądarki.',
    findingAgents: 'Wyszukiwanie Custom Agents…', connected: 'Połączono z Notion.', credentialsSaved: 'Dane logowania: zapisane lokalnie i ukryte',
    authFailed: 'Nie udało się ukończyć logowania do Notion.', manualAuth: 'Użyj ręcznego trybu tokenów', troubleshooting: 'Otwórz rozwiązywanie problemów',
    agentsTitle: 'Wybierz Custom Agent', modelsTitle: 'Wybierz model dla tego agenta', noAgents: 'Nie znaleziono dostępnych Custom Agents.',
    retry: 'Ponów', createAgent: 'Otwórz agentów Notion', configSaved: 'Konfiguracja zapisana.',
    gitignoreConfirm: 'Dodać brakujące wpisy bezpieczeństwa Nodex do .gitignore?', doctorTitle: 'Wyniki diagnostyki',
    docsOpened: 'Dokumentacja została otwarta w przeglądarce.', goodbye: 'Konfiguracja Nodex została zamknięta.',
    errorTitle: 'Nie udało się ukończyć tego kroku', workspace: 'Obszar roboczy', account: 'Konto', model: 'Model',
  }),
  sr: translated({
    tagline: 'Ваш Notion агент — свуда где раде OpenAI модели.',
    version: 'Верзија', license: 'Apache-2.0 лиценца', mainMenu: 'Подешавање Nodex-а',
    menu: {
      connect: 'Повежи Notion', 'select-agent': 'Изабери агента и модел', 'api-key': 'Преузми API кључ',
      verify: 'Провери везу', 'prepare-agent': 'Припреми агента за Codex', 'start-server': 'Покрени сервер',
      doctor: 'Дијагностика', language: 'Промени језик', documentation: 'Отвори документацију', exit: 'Изађи',
    },
    changeAccount: 'Промени Notion налог', back: 'Назад', continue: 'Настави', yes: 'Да', no: 'Не', current: 'тренутни',
    connectFirst: 'Прво повежите Notion, затим изаберите агента.', openingNotion: 'Отварам Notion у приватном Nodex профилу прегледача…',
    checkingSession: 'Проверавам сачувану Notion сесију…', waitingForSignIn: 'Чекам пријаву… Завршите је у видљивом прозору прегледача.',
    findingAgents: 'Тражим ваше Custom Agents…', connected: 'Notion је повезан.', credentialsSaved: 'Акредитиви: сачувани локално и сакривени',
    authFailed: 'Пријава на Notion није могла да се заврши.', manualAuth: 'Користи ручни унос токена', troubleshooting: 'Отвори решавање проблема',
    agentsTitle: 'Изаберите Custom Agent', modelsTitle: 'Изаберите модел за агента', noAgents: 'Нису пронађени доступни Custom Agents.',
    retry: 'Покушај поново', createAgent: 'Отвори Notion агенте', configSaved: 'Конфигурација је сачувана.',
    gitignoreConfirm: 'Додати недостајуће Nodex безбедносне уносе у .gitignore?', doctorTitle: 'Резултати дијагностике',
    docsOpened: 'Документација је отворена у прегледачу.', goodbye: 'Nodex подешавање је затворено.',
    errorTitle: 'Овај корак није могао да се заврши', workspace: 'Радни простор', account: 'Налог', model: 'Модел',
  }),
};

export const NODEX_LOGO = [
  ' _   _           _            ',
  '| \\ | | ___   __| | _____  __',
  '|  \\| |/ _ \\ / _` |/ _ \\ \\/ /',
  '| |\\  | (_) | (_| |  __/>  < ',
  '|_| \\_|\\___/ \\__,_|\\___/_/\\_\\',
];
