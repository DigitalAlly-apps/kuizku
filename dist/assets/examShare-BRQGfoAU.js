import{c as s,N as u}from"./index-CPvk0-B7.js";/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=s("SlidersHorizontal",[["line",{x1:"21",x2:"14",y1:"4",y2:"4",key:"obuewd"}],["line",{x1:"10",x2:"3",y1:"4",y2:"4",key:"1q6298"}],["line",{x1:"21",x2:"12",y1:"12",y2:"12",key:"1iu8h1"}],["line",{x1:"8",x2:"3",y1:"12",y2:"12",key:"ntss68"}],["line",{x1:"21",x2:"16",y1:"20",y2:"20",key:"14d8ph"}],["line",{x1:"12",x2:"3",y1:"20",y2:"20",key:"m0wm8r"}],["line",{x1:"14",x2:"14",y1:"2",y2:"6",key:"14e1ph"}],["line",{x1:"8",x2:"8",y1:"10",y2:"14",key:"1i6ji0"}],["line",{x1:"16",x2:"16",y1:"18",y2:"22",key:"1lctlv"}]]);function o(t){return t?new Date(t).toLocaleString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:!1,hourCycle:"h23"}):"Setelah ujian dipublikasikan"}function l(t){if(t.settings.timerMode!=="NONE"){if(t.settings.timerMode==="WHOLE_EXAM"&&t.settings.wholExamTimerSeconds)return`${Math.ceil(t.settings.wholExamTimerSeconds/60)} menit untuk seluruh ujian`;if(t.settings.timerMode==="PER_QUESTION"&&t.settings.perQuestionDefaultSeconds)return`${t.settings.perQuestionDefaultSeconds} detik per soal`}}function c(t,a){var n;const i=l(t),e=t.settings.maxAttempts,r=e===1?"Percobaan: 1x (tidak bisa mengulang)":e>1?`Percobaan: ${e}x`:void 0;return[`📝 *${t.title}*`,(n=t.description)==null?void 0:n.trim(),`
Kode ujian: *${t.code}*`,`Link ujian: ${a}`,`
Bentuk soal: ${u(t.format)}`,`Jumlah soal: ${t.questions.length} soal`,t.activeFrom?`Waktu dibuka: ${o(t.activeFrom)}`:void 0,`Waktu ditutup: ${t.activeTo?o(t.activeTo):"Tidak dibatasi"}`,i?`Timer: ${i}`:void 0,r,`
Silakan masuk menggunakan kode atau link di atas.`].filter(Boolean).join(`
`)}export{y as S,c as b};
