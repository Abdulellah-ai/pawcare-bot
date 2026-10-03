/* Deterministic safety layer. Pure functions, no dependencies (inlined into n8n Code nodes by the build script).
 * The LLM never decides emergencies; this runs BEFORE it. Patterns are written naturally and normalised at load. */

function normalize(input) {
  let s = String(input == null ? "" : input);
  s = s.replace(/[ً-ٰٟـ]/g, "");            // tashkeel + tatweel
  s = s.replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي");
  s = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));  // Arabic-Indic digits
  s = s.replace(/(.)\1{3,}/g, "$1$1");                           // "هلللللا" -> "هلا"
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

const norm = (p) => new RegExp(normalize(p), "i");

const EMERGENCY = [
  ["breathing", "(بتتنفس|بيتنفس|بتنفس|يتنفس|تتنفس|نفسه|نفسها).{0,12}(بصعوبه|بتعب|ثقيل|صعب)|صعوبه (في )?(ال)?تنفس|مش قادر (على )?(ال)?تنفس|ما (بيقدر|بقدر|بتقدر) (يتنفس|تتنفس)|لهاث شديد|يلهث بشده|ما بيتنفس|ازرق(ت)? (لثت|لسان)|لثه (زرقا|زرقاء|ازرق|شاحبه)|difficulty breathing|trouble breathing|can'?t breathe|cannot breathe|struggling to breathe|gasping|choking|blue gums|pale gums|open[- ]mouth breathing"],
  ["poisoning", "سمم|تسمم|مسموم|سم (فئران|جرذان|الفئران)|اكل(ت)? (شو?كو?ل(?:ا?ت|ا(?: |$))|تشوكليت|chocolate|عنب|زبيب|بصل|ثوم|سم|مسمار|خيط|علكه)|ابتلع(ت)? (سم|دواء|حبوب|منظف|مادة|شي حاد)|شرب (منظف|كلور|مضاد تجمد)|poison|toxic|ate (some )?(chocolate|grapes|raisins|onions?|garlic|xylitol|rat poison|lilies|lily)|swallowed (a )?(pill|medication|medicine|battery|bleach|string)|ingested|antifreeze"],
  ["seizure_collapse", "تشنج|نوبه صرع|صرع|اغماء|اغمي عليه|فقد (ال)?وعي|فاقد (ال)?وعي|انهار|وقع (مغشي|مغمي)|لا يستجيب|مش مستجيب|seizure|convuls|collapsed|unconscious|passed out|fainted|unresponsive"],
  ["severe_bleeding", "نزيف (شديد|قوي|كثير|ما بيوقف|لا يتوقف)|بينزف (كتير|كثير)|دم (كتير|كثير|غزير)|ما (بيوقف|يتوقف) (ال)?نزيف|severe bleeding|bleeding (a lot|heavily|badly|profusely)|won'?t stop bleeding|blood everywhere"],
  ["trauma", "حادث سير|حادث سياره|دهسته|دعسته|دهسها|دعسها|سياره (دهست|دعست|ضربت|صدمت)|صدمته سياره|وقع من (فوق|الطابق|البلكون|الشباك|السطح)|سقط من (فوق|الطابق|البلكون|الشباك|السطح)|هجم (عليه|عليها) كلب|عضه كلب كبير|hit by (a )?car|run over|fell from (a )?(height|balcony|window|roof|floor)|car accident|attacked by (a )?dog"],
  ["urinary_blockage", "(ذكر|قطي|القط|الولد).{0,40}(ما|مش|بدون|لا).{0,15}(يتبول|بيتبول|يبول|ببول|بتبول)|يحاول (ال)?(تبول|يتبول|يبول).{0,25}(ولا|وما|بدون|مش|ما)|ما (بيطلع|طلع) (منه )?(بول|شي)|بول (دم|دموي)|can'?t pee|cannot pee|unable to (pee|urinate)|straining to (pee|urinate)|trying to (pee|urinate).{0,30}(nothing|nothing comes|no urine)|urinary (block|obstruction)"],
  ["bloat", "انتفاخ (شديد|بطنه|البطن)|بطنه (منتفخ|كبير|قاسي|متحجر)|يحاول (يتقيا|يرجع).{0,25}(ولا|وما|بدون)|bloat|swollen (hard )?(abdomen|belly|stomach)|retching.{0,20}nothing"],
  ["birthing", "ولاد[^ ]{0,5} (متعسر|صعب|عالق)|(جرو|قطه صغيره|مولود) عالق|الطلق (من|صار له) (ساعات|كتير)|difficult (birth|labou?r|delivery)|dystocia|stuck (puppy|kitten)|labou?r.{0,30}(hours|since this morning)"],
  ["paralysis", "ما (بقدر|يقدر|بيقدر|بتقدر|تقدر) (يمشي|تمشي|يقف|تقف|يتحرك|تتحرك)|فجاه (ما|مش) (بيمشي|يمشي|بتمشي)|شلل|مشلول|اطراف خلفيه (ما|مش)|suddenly can'?t (walk|stand)|can'?t (stand|walk) (up|at all)|paralyz|paralys|dragging (his|her|its) back legs"],
  ["eye_injury", "عينه (طلعت|خرجت|نازله|مصابه بشده|مجروحه)|عينها (طلعت|خرجت|نازله)|عين (بارزه|خارجه)|proptos|eye (popped|is out|bulging)|eyeball"],
  ["heatstroke", "ضربه شمس|ضربه حراره|ترك(ته|ناه|ها) (في|ب) (ال)?سياره|heat ?stroke|overheat|left in (a )?(hot )?car"],
  ["snakebite", "لدغ(ته|تها)? (افعى|ثعبان|عقرب)|لدغه (افعى|ثعبان|عقرب)|snake ?bite|bitten by (a )?(snake|scorpion)|scorpion sting"],
];
const EMERGENCY_RE = EMERGENCY.map(([cat, src]) => [cat, norm(src)]);

/** Returns { emergency: boolean, categories: string[] } for a customer message. Intentionally recall-biased: a false alarm only wakes a human. */
function detectEmergency(text) {
  const t = normalize(text);
  const categories = EMERGENCY_RE.filter(([, re]) => re.test(t)).map(([c]) => c);
  return { emergency: categories.length > 0, categories };
}

const INJECTION = [
  ["override", "(ignore|disregard|forget|override|bypass)\\s+(all|any|the|your|previous|prior|above|earlier|these)|تجاهل|تجاهلي|انس(ى)?\\s+(كل|جميع)|الغ(ي)?\\s+(كل\\s+)?(ال)?(قواعد|تعليمات)|لا تلتزم"],
  ["role_hijack", "you are now|developer mode|jailbreak|\\bdan\\b|pretend (to be|you)|act as (a|an|if)|ان(ت|ا) الان|تقمص|تصرف (ك|كانك)|وضع (ال)?مطور"],
  ["prompt_exfil", "system prompt|reveal.{0,30}(prompt|instruction)|show.{0,30}(prompt|instruction)|print.{0,30}instruction|repeat (the|your) (instructions|prompt)|اكشف.{0,30}(تعليمات|برومبت|اوامر)|اظهر.{0,30}(تعليمات|برومبت)|اعرض.{0,30}(تعليمات|برومبت)|ما (هي )?تعليماتك"],
  ["secrets", "api[_ -]?key|service[_ -]?role|password|secret|bearer |token|كلمه (ال)?(سر|مرور)|مفتاح (ال)?(api|سر)"],
  ["infra", "drop\\s+table|delete\\s+from|truncate\\s|shutdown|rm\\s+-rf|sudo\\s|اوقف (ال)?(سيرفر|خادم|نظام|بوت)|اطفي (ال)?(سيرفر|نظام|بوت)|احذف (ال)?(قاعده|بيانات|جدول)|stop the (server|bot|system)|turn off the (server|bot)|delete (the )?(database|data|all)"],
  ["markup", "<\\s*script|<\\/?(system|assistant|instruction)|\\[\\/?inst\\]|###\\s*(system|instruction)"],
];
const INJECTION_RE = INJECTION.map(([cat, src]) => [cat, norm(src)]);

/** Flags suspicious customer text. Used for logging + a hardened model call. Never used to execute anything. */
function detectInjection(text) {
  const t = normalize(text);
  const categories = INJECTION_RE.filter(([, re]) => re.test(t)).map(([c]) => c);
  return { suspicious: categories.length > 0, categories };
}

/** 'ar' | 'en' | 'other' by script share. */
function detectLanguage(text) {
  const s = String(text == null ? "" : text);
  const ar = (s.match(/[؀-ۿ]/g) || []).length;
  const en = (s.match(/[A-Za-z]/g) || []).length;
  if (ar === 0 && en === 0) return "other";
  return ar >= en ? "ar" : "en";
}

/** Hard cap + control-char strip before anything reaches a model or the database. */
function sanitizeInput(text, max) {
  const limit = max || 2000;
  return String(text == null ? "" : text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "").slice(0, limit).trim();
}

if (typeof module !== "undefined") module.exports = { normalize, detectEmergency, detectInjection, detectLanguage, sanitizeInput };
