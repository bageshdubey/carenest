# CareNest

**A WhatsApp health companion for elders on several medicines.** The son or daughter sets it up once on a web app. The parent only uses WhatsApp: they send a photo of the prescription and get their tablets back by meal, a reminder at every meal, and plain answers about their own list and reports.

CareNest analyses, it never advises. Every reply comes from the parent's own prescription and reports, never from the AI's opinion.

**Live app:** https://carenestapp.vercel.app
**Status:** Runs on the WhatsApp test number. Hindi and Marathi texts are drafts and still need a native speaker's check.

## Contents

- [How it works](#how-it-works)
- [What the parent gets on WhatsApp](#what-the-parent-gets-on-whatsapp)
- [What the child sees on the web app](#what-the-child-sees-on-the-web-app)
- [Safety rules](#safety-rules)

## How it works

1. **The child sets up** on the web app with Google login: the parent's name, WhatsApp number, language and meal times.
2. **The child shares a link** with the parent. The parent taps it and sends the prefilled message, which links their number.
3. **The parent sends a prescription photo** on WhatsApp. Gemini reads the medicines.
4. **The child checks the list** on the web app and approves it. Nothing is reminded until the child approves.
5. **Reminders go at every meal** with a "Taken" button. A dose not marked within 60 minutes shows on the child's dashboard.
6. **Lab reports, questions and doctor visits** follow the same path: the parent sends, CareNest compares with what is printed, the child sees everything.

## What the parent gets on WhatsApp

- **Their tablets by meal:** breakfast, lunch and dinner, before or after food.
- **A reminder at each meal**, with "Taken" and "My full list" buttons.
- **Answers about their own list**, typed or by voice note: "What do I take at lunch?", "How many medicines?".
- **A short report summary:** how many results are inside, outside or without a printed range, and only the ones outside it, with what each test is.
- **Questions to ask the doctor**, built from results outside the range. Questions only, never answers.
- **Doctor visit reminders:** the evening before and the morning of the visit.
- **A voice note** in English, Hindi or Marathi with each reply (Sarvam), when the parent has written in the last 24 hours.

## What the child sees on the web app

- **Home:** today's doses by meal and the next dose time, doses taken by week or month, ongoing medicines, the next doctor visit and the latest report in one line.
- **Medicines:** the ongoing list on top, then every prescription since the first, newest first, with who sent it, when, and which medicines are ongoing or stopped.
- **Reports:** by test, with earlier values and higher or lower than last time; or by date, one folded card per report.
- **Chat:** every message between the parent and CareNest.
- **Alerts:** a new prescription to check, a dose not marked, results outside range, an advice question, an emergency.
- **Settings:** meal times, languages and the parent's number.

## Safety rules

These are built into the code, not left to the AI.

- **Fixed replies.** Every message to the parent is written. The AI only reads photos and works out what kind of question was asked. The one exception is a short answer about the parent's own medicines, taken from their list only.
- **Ranges are compared in code.** A result is "high" or "low" only against the range printed on the report.
- **Emergency words are checked in code** in English, Hindi and Marathi before anything else. The parent is told to call their child or 108, and the child gets an urgent alert.
- **Advice questions are not answered.** Dose changes, symptoms or substitutes get "please ask your doctor", and the child is told.
- **The child approves every list** before any reminder goes.
- **No brand is matched to a generic.** That is a substitute decision, which CareNest never makes.
- **CareNest never asks for money, OTP or passwords, and never sends links** to the parent.
