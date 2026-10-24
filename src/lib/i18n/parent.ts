import type { Food, MealKey, Medicine, ParentLang, ReportValue } from "@/lib/domain/types";
import { MEALS, type MealKey as MK } from "@/lib/domain/types";
import { formatTime, medicinesFor } from "@/lib/domain/meals";

/**
 * Every WhatsApp message the parent receives. Fixed text only: the AI never
 * writes replies about doses, substitutes, symptoms or emergencies.
 * Hindi and Marathi are drafts. [CHECK] with a native speaker before real users.
 * In Hindi and Marathi, CareNest speaks as a woman (करती हूँ, शकते), to match the Sarvam
 * voices in SARVAM_SPEAKER_HI and SARVAM_SPEAKER_MR. Change the two together.
 */
type Vars = Record<string, string>;

const MSG = {
  en: {
    welcome:
      "Namaste {n}. I'm CareNest. {c} set me up for you.\nSend me a photo of your prescription, and I'll send back your tablets by breakfast, lunch and dinner.\nI never ask for money, OTP or passwords, and never send links.",
    already: "{c} already added your prescription.",
    gotRx: "Thank you, {n}. I've read it. {c} is checking the list. Until then, follow your paper prescription.",
    checked: "{c} checked your list, {n}. From now on I'll remind you at each meal.",
    footer: "Always follow your prescription and your doctor.",
    reminder: "{meal} time, {n}.\n{lines}\nList checked by {c}.",
    thanks: "Thank you, {n}. {c} can see it.",
    fixed: "I can only show what is on your prescription, {n}. For this, please ask your doctor, or call {c}.",
    emergency: "{n}, please call {c} now, or 108 for an ambulance.",
    repIntro: "Here is a summary of your report, {n}. I only compare with the ranges printed on it.",
    repSummary: "I read {k} results: {i} within the printed range, {o} outside it, {u} with no printed range.",
    repOutside: "Outside the printed range:",
    repAllIn: "No result is outside the printed range.",
    repMore: "…and {k} more.",
    repFull: "{c} can see the full report.",
    repRow: "• {t}: {v}. Printed range {r}. {s}. Last time {l}.",
    repRowNoLast: "• {t}: {v}. Printed range {r}. {s}.",
    repWhat: "  What it is: {w}",
    repWhy: "  Why it's done: {w}",
    repFocus: "Please show these to your doctor: {list}.",
    repFocusMore: "and {k} more",
    repOutro: "Please show this to your doctor. I can't say what it means for your health.",
    docQIntro: "You could ask your doctor:",
    docQValue: "My {t} is {dir} the printed range. What does that mean for me?",
    docQMeds: "Should anything change in my medicines?",
    docQRetest: "When should I test again?",
    docQOutro: "Write down the answers, or ask {c} to come with you.",
    above: "above",
    below: "below",
    high: "High",
    low: "Low",
    inRange: "In range",
    unknown: "No printed range",
    notADoc: "I couldn't find a prescription or a report in this photo, {n}. Please send a clear photo of the full page.",
    unclearPhoto: "This photo is hard to read, {n}. Please take it again in good light, with the whole page in the photo.",
    busy: "I'm a little busy right now, {n}. Please send it again in a minute.",
    help: "{n}, you can send me a photo of a prescription or a report, ask me about your medicines by voice note, or tap a button below.",
    noList: "I don't have your list yet, {n}. Send me a photo of your prescription.",
    waiting: "{c} is still checking your list, {n}. Until then, follow your paper prescription.",
    invite: "{n}, tap this link and send the message. It's CareNest, for your medicines: {link}",
    unknownNumber:
      "Namaste. I'm CareNest. Your family member needs to set me up for you first. Please ask them to send you the link.",
    wrongNumber:
      "This link was made for a different WhatsApp number. Please ask your family member to check the number they entered.",
    q_taken: "Taken",
    q_later: "Later",
    laterOk: "OK, {n}. I'll remind you again at {t}.",
    laterLimit: "OK, {n}. Tap Taken when you've had them.",
    laterClosed: "{n}, this reminder is already closed.",
    followup: "{n}, just checking: have you taken your {meal} tablets?",
    q_list: "My full list",
    q_doc: "Questions for doctor",
    youAsked: 'You asked: "{q}"',
    mealMeds: "{n}, at {meal} you take:\n{lines}",
    noMealMeds: "{n}, you have no medicines at {meal}.",
    medCount: "{n}, you have {k} medicines on your list: {names}.",
    noReport: "I don't have a report yet, {n}. Send me a photo of it.",
    visitNext: "{n}, your next doctor visit is on {d}{t}.",
    visitNone: "I don't have your next visit date, {n}. Please check your prescription or ask {c}.",
    visitEve: "{n}, tomorrow ({d}) is your doctor visit{t}. Keep your prescriptions and reports ready.",
    visitMorning: "{n}, today is your doctor visit{t}. Take your prescriptions and reports with you.",
    timeAt: " at {t}",
    sosTitle: "Only when needed (no reminder)",
    until: "until {d}",
  },
  hi: {
    welcome:
      "नमस्ते {n}। मैं CareNest हूँ। {c} ने मुझे आपके लिए शुरू किया है।\nअपने पर्चे की फ़ोटो भेजिए, मैं आपकी गोलियाँ नाश्ते, दोपहर और रात के खाने के हिसाब से भेज दूँगी।\nमैं कभी पैसे, OTP या पासवर्ड नहीं माँगती, और कोई लिंक नहीं भेजती।",
    already: "{c} ने आपका पर्चा पहले ही जोड़ दिया है।",
    gotRx: "धन्यवाद {n}। मैंने पढ़ लिया है। {c} सूची जाँच रहे हैं। तब तक अपने कागज़ वाले पर्चे के हिसाब से ही दवा लें।",
    checked: "{c} ने आपकी सूची जाँच ली है, {n}। अब से मैं हर खाने के समय याद दिलाऊँगी।",
    footer: "हमेशा अपने पर्चे और डॉक्टर की बात मानें।",
    reminder: "{n}, {meal} का समय।\n{lines}\nसूची {c} ने जाँची है।",
    thanks: "धन्यवाद {n}। {c} यह देख सकते हैं।",
    fixed: "{n}, मैं सिर्फ़ वही बता सकती हूँ जो आपके पर्चे में लिखा है। इसके लिए कृपया अपने डॉक्टर से पूछें, या {c} को फ़ोन करें।",
    emergency: "{n}, कृपया अभी {c} को फ़ोन करें, या एम्बुलेंस के लिए 108 पर।",
    repIntro: "{n}, यह आपकी रिपोर्ट का सार है। मैं सिर्फ़ उस पर छपी रेंज से तुलना करती हूँ।",
    repSummary: "मैंने {k} नतीजे पढ़े: {i} छपी रेंज में, {o} रेंज से बाहर, {u} की कोई छपी रेंज नहीं।",
    repOutside: "छपी रेंज से बाहर:",
    repAllIn: "कोई भी नतीजा छपी रेंज से बाहर नहीं है।",
    repMore: "…और {k} नतीजे।",
    repFull: "पूरी रिपोर्ट {c} देख सकते हैं।",
    repRow: "• {t}: {v}। छपी रेंज {r}। {s}। पिछली बार {l}।",
    repRowNoLast: "• {t}: {v}। छपी रेंज {r}। {s}।",
    repWhat: "  यह क्या है: {w}",
    repWhy: "  यह क्यों होता है: {w}",
    repFocus: "कृपया ये डॉक्टर को दिखाएँ: {list}।",
    repFocusMore: "और {k} नतीजे",
    repOutro: "कृपया यह अपने डॉक्टर को दिखाएँ। इसका आपकी सेहत के लिए क्या मतलब है, यह मैं नहीं बता सकती।",
    docQIntro: "आप डॉक्टर से पूछ सकते हैं:",
    docQValue: "मेरा {t} छपी रेंज से {dir} है। मेरे लिए इसका क्या मतलब है?",
    docQMeds: "क्या मेरी दवाओं में कुछ बदलना चाहिए?",
    docQRetest: "मुझे दोबारा टेस्ट कब करवाना चाहिए?",
    docQOutro: "जवाब लिख लें, या {c} को साथ ले जाएँ।",
    above: "ज़्यादा",
    below: "कम",
    high: "ज़्यादा",
    low: "कम",
    inRange: "रेंज में",
    unknown: "कोई छपी रेंज नहीं",
    notADoc: "{n}, इस फ़ोटो में मुझे पर्चा या रिपोर्ट नहीं मिली। कृपया पूरे पन्ने की साफ़ फ़ोटो भेजें।",
    unclearPhoto: "{n}, यह फ़ोटो पढ़ना मुश्किल है। कृपया अच्छी रोशनी में पूरे पन्ने की फ़ोटो फिर से लें।",
    busy: "{n}, मैं अभी थोड़ी व्यस्त हूँ। कृपया एक मिनट बाद फिर से भेजें।",
    help: "{n}, आप मुझे पर्चे या रिपोर्ट की फ़ोटो भेज सकते हैं, अपनी दवाओं के बारे में बोलकर (वॉइस नोट) पूछ सकते हैं, या नीचे कोई बटन दबाएँ।",
    noList: "{n}, मेरे पास अभी आपकी सूची नहीं है। अपने पर्चे की फ़ोटो भेजिए।",
    waiting: "{n}, {c} अभी आपकी सूची जाँच रहे हैं। तब तक अपने कागज़ वाले पर्चे के हिसाब से ही दवा लें।",
    invite: "{n}, यह लिंक दबाइए और मैसेज भेज दीजिए। यह CareNest है, आपकी दवाओं के लिए: {link}",
    unknownNumber:
      "नमस्ते। मैं CareNest हूँ। पहले आपके परिवार के किसी सदस्य को मुझे आपके लिए शुरू करना होगा। कृपया उनसे लिंक भेजने को कहें।",
    wrongNumber: "यह लिंक किसी दूसरे WhatsApp नंबर के लिए बना है। कृपया अपने परिवार वालों से डाला गया नंबर जाँचने को कहें।",
    q_taken: "ले ली",
    q_later: "बाद में",
    laterOk: "ठीक है {n}। मैं {t} पर फिर याद दिलाऊँगी।",
    laterLimit: "ठीक है {n}। दवा लेने के बाद \"ले ली\" दबाएँ।",
    laterClosed: "{n}, यह याद पहले ही बंद हो चुकी है।",
    followup: "{n}, बस पूछ रही हूँ: क्या आपने {meal} वाली दवा ले ली?",
    q_list: "मेरी पूरी सूची",
    q_doc: "डॉक्टर के लिए सवाल",
    youAsked: 'आपने पूछा: "{q}"',
    mealMeds: "{n}, {meal} के समय आपकी दवाएँ:\n{lines}",
    noMealMeds: "{n}, {meal} के समय आपकी कोई दवा नहीं है।",
    medCount: "{n}, आपकी सूची में {k} दवाएँ हैं: {names}।",
    noReport: "{n}, मेरे पास अभी कोई रिपोर्ट नहीं है। उसकी फ़ोटो भेजिए।",
    visitNext: "{n}, आपकी अगली डॉक्टर विज़िट {d} को है{t}।",
    visitNone: "{n}, मेरे पास आपकी अगली विज़िट की तारीख़ नहीं है। कृपया पर्चा देखें या {c} से पूछें।",
    visitEve: "{n}, कल ({d}) आपकी डॉक्टर विज़िट है{t}। अपने पर्चे और रिपोर्ट तैयार रखें।",
    visitMorning: "{n}, आज आपकी डॉक्टर विज़िट है{t}। अपने पर्चे और रिपोर्ट साथ ले जाएँ।",
    timeAt: ", समय {t}",
    sosTitle: "ज़रूरत होने पर (याद नहीं दिलाया जाएगा)",
    until: "{d} तक",
  },
  mr: {
    welcome:
      "नमस्कार {n}. मी CareNest आहे. {c} यांनी मला तुमच्यासाठी सुरू केले आहे.\nतुमच्या प्रिस्क्रिप्शनचा फोटो पाठवा, मी तुमच्या गोळ्या नाश्ता, दुपारचे जेवण आणि रात्रीचे जेवण यानुसार पाठवेन.\nमी कधीही पैसे, OTP किंवा पासवर्ड मागत नाही, आणि लिंक पाठवत नाही.",
    already: "{c} यांनी तुमचे प्रिस्क्रिप्शन आधीच जोडले आहे.",
    gotRx: "धन्यवाद {n}. मी वाचले आहे. {c} यादी तपासत आहेत. तोपर्यंत तुमच्या कागदी प्रिस्क्रिप्शनप्रमाणेच औषध घ्या.",
    checked: "{c} यांनी तुमची यादी तपासली आहे, {n}. आता प्रत्येक जेवणाच्या वेळी मी आठवण करून देईन.",
    footer: "नेहमी तुमचे प्रिस्क्रिप्शन आणि डॉक्टरांचे ऐका.",
    reminder: "{n}, {meal}ची वेळ.\n{lines}\nयादी {c} यांनी तपासली आहे.",
    thanks: "धन्यवाद {n}. {c} हे पाहू शकतात.",
    fixed: "{n}, मी फक्त तुमच्या प्रिस्क्रिप्शनमध्ये जे लिहिले आहे तेच सांगू शकते. यासाठी कृपया तुमच्या डॉक्टरांना विचारा, किंवा {c} यांना फोन करा.",
    emergency: "{n}, कृपया आत्ता {c} यांना फोन करा, किंवा रुग्णवाहिकेसाठी 108 ला.",
    repIntro: "{n}, हा तुमच्या रिपोर्टचा सारांश आहे. मी फक्त त्यावर छापलेल्या रेंजशी तुलना करते.",
    repSummary: "मी {k} निकाल वाचले: {i} छापलेल्या रेंजमध्ये, {o} रेंजबाहेर, {u} साठी छापलेली रेंज नाही.",
    repOutside: "छापलेल्या रेंजबाहेर:",
    repAllIn: "कोणताही निकाल छापलेल्या रेंजबाहेर नाही.",
    repMore: "…आणि आणखी {k} निकाल.",
    repFull: "पूर्ण रिपोर्ट {c} पाहू शकतात.",
    repRow: "• {t}: {v}. छापलेली रेंज {r}. {s}. मागच्या वेळी {l}.",
    repRowNoLast: "• {t}: {v}. छापलेली रेंज {r}. {s}.",
    repWhat: "  हे काय आहे: {w}",
    repWhy: "  हे का करतात: {w}",
    repFocus: "कृपया हे डॉक्टरांना दाखवा: {list}.",
    repFocusMore: "आणि आणखी {k}",
    repOutro: "कृपया हे तुमच्या डॉक्टरांना दाखवा. याचा तुमच्या आरोग्यासाठी काय अर्थ आहे, हे मी सांगू शकत नाही.",
    docQIntro: "तुम्ही डॉक्टरांना विचारू शकता:",
    docQValue: "माझे {t} छापलेल्या रेंजपेक्षा {dir} आहे. माझ्यासाठी याचा काय अर्थ आहे?",
    docQMeds: "माझ्या औषधांमध्ये काही बदल करायला हवा का?",
    docQRetest: "मी पुन्हा टेस्ट कधी करावी?",
    docQOutro: "उत्तरे लिहून ठेवा, किंवा {c} यांना सोबत घेऊन जा.",
    above: "जास्त",
    below: "कमी",
    high: "जास्त",
    low: "कमी",
    inRange: "रेंजमध्ये",
    unknown: "छापलेली रेंज नाही",
    notADoc: "{n}, या फोटोमध्ये मला प्रिस्क्रिप्शन किंवा रिपोर्ट सापडला नाही. कृपया संपूर्ण पानाचा स्पष्ट फोटो पाठवा.",
    unclearPhoto: "{n}, हा फोटो वाचायला कठीण आहे. कृपया चांगल्या प्रकाशात संपूर्ण पानाचा फोटो पुन्हा काढा.",
    busy: "{n}, मी आत्ता थोडी व्यस्त आहे. कृपया एका मिनिटाने पुन्हा पाठवा.",
    help: "{n}, तुम्ही मला प्रिस्क्रिप्शन किंवा रिपोर्टचा फोटो पाठवू शकता, तुमच्या औषधांबद्दल बोलून (व्हॉइस नोट) विचारू शकता, किंवा खालील बटण दाबा.",
    noList: "{n}, माझ्याकडे अजून तुमची यादी नाही. तुमच्या प्रिस्क्रिप्शनचा फोटो पाठवा.",
    waiting: "{n}, {c} अजून तुमची यादी तपासत आहेत. तोपर्यंत तुमच्या कागदी प्रिस्क्रिप्शनप्रमाणेच औषध घ्या.",
    invite: "{n}, ही लिंक दाबा आणि मेसेज पाठवा. हे CareNest आहे, तुमच्या औषधांसाठी: {link}",
    unknownNumber:
      "नमस्कार. मी CareNest आहे. आधी तुमच्या कुटुंबातील कोणीतरी मला तुमच्यासाठी सुरू करायला हवे. कृपया त्यांना लिंक पाठवायला सांगा.",
    wrongNumber: "ही लिंक दुसऱ्या WhatsApp नंबरसाठी बनवली आहे. कृपया तुमच्या कुटुंबीयांना टाकलेला नंबर तपासायला सांगा.",
    q_taken: "घेतली",
    q_later: "नंतर",
    laterOk: "ठीक आहे {n}. मी {t} ला पुन्हा आठवण करून देईन.",
    laterLimit: "ठीक आहे {n}. औषध घेतल्यावर \"घेतली\" दाबा.",
    laterClosed: "{n}, ही आठवण आधीच बंद झाली आहे.",
    followup: "{n}, फक्त विचारते: तुम्ही {meal}ची औषधे घेतली का?",
    q_list: "माझी पूर्ण यादी",
    q_doc: "डॉक्टरांसाठी प्रश्न",
    youAsked: 'तुम्ही विचारले: "{q}"',
    mealMeds: "{n}, {meal}च्या वेळी तुमची औषधे:\n{lines}",
    noMealMeds: "{n}, {meal}च्या वेळी तुमचे कोणतेही औषध नाही.",
    medCount: "{n}, तुमच्या यादीत {k} औषधे आहेत: {names}.",
    noReport: "{n}, माझ्याकडे अजून कोणताही रिपोर्ट नाही. त्याचा फोटो पाठवा.",
    visitNext: "{n}, तुमची पुढची डॉक्टर भेट {d} रोजी आहे{t}.",
    visitNone: "{n}, माझ्याकडे तुमच्या पुढच्या भेटीची तारीख नाही. कृपया प्रिस्क्रिप्शन पाहा किंवा {c} यांना विचारा.",
    visitEve: "{n}, उद्या ({d}) तुमची डॉक्टर भेट आहे{t}. तुमची प्रिस्क्रिप्शन आणि रिपोर्ट तयार ठेवा.",
    visitMorning: "{n}, आज तुमची डॉक्टर भेट आहे{t}. तुमची प्रिस्क्रिप्शन आणि रिपोर्ट सोबत घ्या.",
    timeAt: ", वेळ {t}",
    sosTitle: "गरज असेल तेव्हा (आठवण केली जाणार नाही)",
    until: "{d} पर्यंत",
  },
} as const;

export type ParentMsgKey = keyof (typeof MSG)["en"];

const MEAL_NAMES: Record<ParentLang, Record<MealKey, string>> = {
  en: { b: "Breakfast", l: "Lunch", d: "Dinner" },
  hi: { b: "नाश्ता", l: "दोपहर का खाना", d: "रात का खाना" },
  mr: { b: "नाश्ता", l: "दुपारचे जेवण", d: "रात्रीचे जेवण" },
};

const FOOD_NAMES: Record<ParentLang, Record<Food, string>> = {
  en: { before: "Before food", after: "After food", any: "Any time" },
  hi: { before: "खाने से पहले", after: "खाने के बाद", any: "कभी भी" },
  mr: { before: "जेवणापूर्वी", after: "जेवणानंतर", any: "कधीही" },
};

const FOR_WORD: Record<ParentLang, (p: string) => string> = {
  en: (p) => `for ${p.toLowerCase()}`,
  hi: (p) => `${p} के लिए`,
  mr: (p) => `${p}साठी`,
};

export function fill(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

export function pm(lang: ParentLang, key: ParentMsgKey, vars: Vars = {}): string {
  return fill(MSG[lang][key], vars);
}

/** "Tuesday, 4 November" in the parent's language. */
export function visitDate(lang: ParentLang, isoDate: string): string {
  const locale = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" }[lang];
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/** The visit line for the parent: date, then time if known. */
export function visitText(lang: ParentLang, key: "visitNext" | "visitEve" | "visitMorning", visit: { visit_date: string; visit_time: string | null }, vars: Vars): string {
  const t = visit.visit_time ? fill(MSG[lang].timeAt, { t: formatTime(visit.visit_time) }) : "";
  return fill(MSG[lang][key], { ...vars, d: visitDate(lang, visit.visit_date), t });
}

export function mealName(lang: ParentLang, meal: MealKey): string {
  return MEAL_NAMES[lang][meal];
}

function medLine(lang: ParentLang, m: Medicine): string {
  const purpose = m.purpose ? ` (${FOR_WORD[lang](m.purpose[lang])})` : "";
  return `• ${m.name} ${m.strength}, ${m.quantity}${purpose}`;
}

/** "31 October" in the parent's language. */
function dayMonth(lang: ParentLang, isoDate: string): string {
  const locale = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" }[lang];
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long", timeZone: "UTC" });
}

/**
 * The full list, grouped by meal and split into before and after food. A course shows its last day.
 * "Only when needed" medicines come last, in their own group.
 */
export function listText(lang: ParentLang, meds: Medicine[]): string {
  const line = (m: Medicine) => {
    const until = m.endsOn ? `, ${fill(MSG[lang].until, { d: dayMonth(lang, m.endsOn) })}` : "";
    return `${medLine(lang, m)}, ${FOOD_NAMES[lang][m.food].toLowerCase()}${until}`;
  };
  const blocks: string[] = [];
  for (const meal of MEALS as MK[]) {
    const ms = medicinesFor(meal, meds);
    if (!ms.length) continue;
    blocks.push(`${MEAL_NAMES[lang][meal]}:\n${ms.map(line).join("\n")}`);
  }
  const sos = meds.filter((m) => m.asNeeded);
  if (sos.length) blocks.push(`${MSG[lang].sosTitle}:\n${sos.map(line).join("\n")}`);
  return blocks.join("\n\n");
}

/** The tablets for one meal, grouped by before and after food. */
export function reminderLines(lang: ParentLang, meal: MealKey, meds: Medicine[]): string {
  const ms = medicinesFor(meal, meds);
  const groups: string[] = [];
  for (const food of ["before", "after", "any"] as Food[]) {
    const g = ms.filter((m) => m.food === food);
    if (g.length) groups.push(`${FOOD_NAMES[lang][food]}:\n${g.map((m) => medLine(lang, m)).join("\n")}`);
  }
  return groups.join("\n");
}

/** Most test names in the "show your doctor" line; the rest become "and N more". */
const FOCUS_MAX = 8;

/** "Please show these to your doctor: Haemoglobin (low), HbA1c (high)." In the report's own order: the app never ranks results. */
function focusLine(lang: ParentLang, outside: ReportValue[]): string {
  const names = outside.slice(0, FOCUS_MAX).map((v) => {
    const flag = v.flag === "high" ? MSG[lang].high : MSG[lang].low;
    return `${v.test} (${lang === "en" ? flag.toLowerCase() : flag})`;
  });
  if (outside.length > FOCUS_MAX) names.push(pm(lang, "repFocusMore", { k: String(outside.length - FOCUS_MAX) }));
  return pm(lang, "repFocus", { list: names.join(", ") });
}

/** WhatsApp allows 4,096 characters in a text. This leaves room for "You asked: …" above a voice answer. */
export const REPORT_MAX = 3500;

/**
 * A short summary of a report: how many results are within, outside or without a printed range,
 * then only the results outside it. Long reports are cut so the message fits in one WhatsApp text;
 * the child sees every value on the dashboard.
 */
export function reportText(
  lang: ParentLang,
  vars: { n: string; c: string },
  values: ReportValue[],
  lastByTest: Record<string, string>,
): string {
  const count = (f: (v: ReportValue) => boolean) => String(values.filter(f).length);
  const outside = values.filter((v) => v.flag === "high" || v.flag === "low");
  const head = [
    pm(lang, "repIntro", vars),
    ...(outside.length ? [focusLine(lang, outside)] : []),
    pm(lang, "repSummary", {
      k: String(values.length),
      i: count((v) => v.flag === "in_range"),
      o: String(outside.length),
      u: count((v) => v.flag === "unknown"),
    }),
  ].join("\n\n");
  const tail = `${pm(lang, "repFull", vars)}\n\n${pm(lang, "repOutro")}`;
  if (!outside.length) return `${head}\n\n${pm(lang, "repAllIn")}\n\n${tail}`;

  const rows = outside.map((v) => {
    const last = lastByTest[v.test.toLowerCase()];
    const row = fill(last ? MSG[lang].repRow : MSG[lang].repRowNoLast, {
      t: v.test,
      v: v.valueText,
      r: v.rangeText ?? "-",
      s: v.flag === "high" ? MSG[lang].high : MSG[lang].low,
      l: last ?? "",
    });
    // Stored as "what it is" and "why it's done" on two lines; older reports have only the first.
    const [what, why] = (v.whatItMeasures?.[lang] ?? "").split("\n");
    const lines = [what && fill(MSG[lang].repWhat, { w: what }), why && fill(MSG[lang].repWhy, { w: why })].filter(Boolean);
    return [row, ...lines].join("\n");
  });

  const kept: string[] = [];
  // Room for the "…and N more" line, in case it is needed.
  let length = head.length + tail.length + MSG[lang].repOutside.length + 40;
  for (const row of rows) {
    if (length + row.length + 1 > REPORT_MAX) break;
    kept.push(row);
    length += row.length + 1;
  }
  const more = rows.length - kept.length;
  const list = [MSG[lang].repOutside, ...kept, ...(more ? [pm(lang, "repMore", { k: String(more) })] : [])].join("\n");
  return `${head}\n\n${list}\n\n${tail}`;
}

/** Questions for the doctor, built in code from flagged values. Questions only, never answers. */
export function doctorQuestions(lang: ParentLang, child: string, flagged: ReportValue[]): string {
  const qs: string[] = flagged
    .filter((v) => v.flag === "high" || v.flag === "low")
    .slice(0, 3)
    .map((v) => fill(MSG[lang].docQValue, { t: v.test, dir: v.flag === "high" ? MSG[lang].above : MSG[lang].below }));
  qs.push(MSG[lang].docQMeds, MSG[lang].docQRetest);
  const numbered = qs.map((q, i) => `${i + 1}. ${q}`).join("\n");
  return `${MSG[lang].docQIntro}\n${numbered}\n\n${fill(MSG[lang].docQOutro, { c: child })}`;
}
