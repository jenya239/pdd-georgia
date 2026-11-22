#!/usr/bin/env node
/**
 * Episode 03 / v2: deterministic script assembly; NO video rendering or network calls.
 * Usage:
 *   node tools/ep03-v2.mjs --write
 *   node tools/ep03-v2.mjs --check
 *   node tools/ep03-v2.mjs --summary
 * The only spoken-word source is video/episodes/ep03/v2/scenario.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folder = path.join(root,"video/episodes/ep03/v2");
const scenario = JSON.parse(readFileSync(path.join(folder,"scenario.json"),"utf8"));

function assertData(d) {
  assert.equal(d.schemaVersion,2);
  assert.equal(d.episode,"ep03");
  assert.ok(d.narrativeArc?.centralQuestion && d.narrativeArc?.resolution,"Narrative architecture is required");
  assert.ok(Array.isArray(d.scenes) && d.scenes.length >= 10);
  const ids = d.scenes.map(s=>s.id);
  assert.equal(new Set(ids).size,ids.length,"duplicate scene IDs");
  assert.ok(ids.every((id,i)=>id===`S${String(i).padStart(2,"0")}`),"unordered scene IDs");
  assert.ok(d.production.idealDurationRangeSeconds[0] < d.production.idealDurationRangeSeconds[1]);
  for (const s of d.scenes) {
    for (const key of ["title","world","visual","motion","focus","delta","reveal","continuity","dramaticFunction","bridgeToNext"]) {
      assert.equal(typeof s[key],"string",`${s.id} missing ${key}`);
      assert.ok(s[key].trim(),`${s.id} blank ${key}`);
    }
    assert.ok(Number.isFinite(s.estimate_s) && s.estimate_s>=15);
    assert.ok(Number.isFinite(s.pause_s) && s.pause_s>=0);
    assert.ok(Array.isArray(s.voice) && s.voice.length>=1 && s.voice.every(v=>v.length>=30));
    assert.ok(Array.isArray(s.norms) && Array.isArray(s.tickets) && Array.isArray(s.overlay));
    assert.ok(s.norms.every(n=>/^(st[\w-]+|sign-[\d.]+)$/.test(n)));
    assert.ok(s.tickets.every(n=>/^\d+$/.test(n)));
  }
  const words = d.scenes.flatMap(s=>s.voice).join(" ").trim().split(/\s+/).length;
  assert.ok(words>=700 && words<=1400,`Unexpected narration length ${words}`);
  const snow = d.scenes.find(x=>x.world==="A5");
  assert.ok(snow && /не будем рисовать победителя/.test(snow.voice.join(" ")));
  const incident = d.scenes.find(x=>x.mode==="documented-case");
  assert.ok(incident?.source_url?.includes("ntsb.gov/"));
  assert.ok(!d.scenes.some(s=>s.voice.some(t=>/мы сейчас рассмотрим|переходим к следующему слайду|давайте разберём пункт/.test(t))));
  return words;
}

function screenplay(d) {
  const out=[
    "# "+d.title,
    "",
    "**Подзаголовок:** "+d.subtitle,
    "**Выпуск:** ep03 / видеоверсия 2. **Язык:** русский. **Статус:** утверждённая сценарная основа для прототипирования; юридическая и визуальная приёмка перед релизом обязательна.",
    "",
    "Этот файл генерируется из `scenario.json`. Слова диктора меняются **только** в `scenario.json` и пересобираются командой `node tools/ep03-v2.mjs --write`. Нельзя править эту копию вручную.",
    "",
    "## Принцип",
    "",
    "Зритель наблюдает один и тот же перекрёсток: не переставляем автомобили и не подменяем ракурс, а меняем одну правовую переменную за другой. Одна дорога, две одинаковые траектории — и разные обязанности. Городская часть с дворовым выездом строится таким же контрфактом. Это визуальное расследование, а не озвучивание учебника.",
    "",
    "## Внутренний сюжет",
    "",
    "**Центральный вопрос:** "+d.narrativeArc.centralQuestion,
    "",
    "**Начальная иллюзия:** "+d.narrativeArc.openingMisdirection,
    "",
    "**Первый ложный сдвиг:** "+d.narrativeArc.firstFalseChange,
    "",
    "**Первый перелом:** "+d.narrativeArc.firstTrueReversal,
    "",
    "**Разрешение:** "+d.narrativeArc.resolution,
    "",
    "Главный стандарт литературной редактуры: `NARRATIVE_BIBLE.md`. Монтаж и техника должны следовать за развитием мысли.",
    "",
    "## Сцены и дословный закадровый текст",
    ""
  ];
  for (const s of d.scenes) {
    out.push(`### ${s.id} · ${s.title}`,"",
      `**Ориентир:** ${s.estimate_s} с · **Мир:** ${s.world} · **Приём:** ${s.mode}`,"",
      "**Диктор (текст в окончательной форме для первого TTS-дубля):**","");
    for (const para of s.voice) out.push("> "+para,"");
    out.push("**Что на экране:** "+s.visual,"",
      "**Анимация и монтаж:** "+s.motion,"",
      "**Что меняем:** `"+s.delta+"` · **Следствие:** "+s.reveal,"",
      "**Зрительный акцент:** "+s.focus,"",
      "**Драматургическая функция:** "+s.dramaticFunction,"",
      "**Причина следующей сцены:** "+s.bridgeToNext,"",
      "**Переход:** "+s.continuity,
      `**Проверочные якоря:** ${s.norms.length?s.norms.join(", "):"внешний подтверждённый случай"}; билеты: ${s.tickets.join(", ")||"не требуются"}; пауза на осмысление: ${s.pause_s} с.`,
      "",
      "**Короткие надписи на экране (НЕ читать диктором):** "+(s.overlay.length?s.overlay.map(t=>"`"+t+"`").join(" · "):"нет"),
      "");
    if (s.source_url) out.push("**Официальный внешний источник:** "+s.source_url,"");
    if (s.audio) out.push("**Звук:** "+s.audio,"");
  }
  out.push("## Техническое использование","",
    "1. Синхронизировать тайминг с реальной TTS-озвучкой по абзацам и паузам, а не нарезать текст под `estimate_s` насильно.",
    "2. Для каждой сцены отрендерить контрольные still: до изменения, во время изменения и после; собрать контакт-лист.",
    "3. Проверить юридические факты отдельно от художественного результата; подробная матрица в `LEGAL_AND_EVIDENCE.md`.",
    "4. **В первую очередь:** `NARRATIVE_BIBLE.md`; затем `VISUAL_BIBLE.md`, `PRODUCTION.md`, `ACCEPTANCE.md` и `GROKBOT_START.md`.",
    "",
    "Существующие `video/episodes/ep03/scenes.py`, `boards.py`, `timeline.json` и опубликованный `content/media/ep03.mp4` этим документом **не заменяются**.",
    "");
  return out.join("\n");
}
function voiceText(d) {
  const out=["# Дословная речь диктора для TTS. Строки @@Sxx — служебные маркеры, НЕ озвучивать.",""];
  for(const s of d.scenes) out.push("@@"+s.id, ...s.voice.flatMap(v=>[v,""]), "");
  return out.join("\n");
}
const artifacts={"SCREENPLAY.md":screenplay(scenario),"VOICE.txt":voiceText(scenario)};
const words=assertData(scenario);
const opt=process.argv[2]||"--summary";
if(opt==="--write") {
  for(const [name,content] of Object.entries(artifacts)) writeFileSync(path.join(folder,name),content,"utf8");
  process.stdout.write("Generated "+Object.keys(artifacts).join(", ")+"\n");
}else if(opt==="--check"){
  for(const [name,content] of Object.entries(artifacts)){
    assert.equal(readFileSync(path.join(folder,name),"utf8"),content,`${name} stale or manually edited; run --write`);
  }
  process.stdout.write("EP03 v2 generated materials in sync\n");
}else if(opt==="--summary"){
  const seconds=scenario.scenes.reduce((a,s)=>a+s.estimate_s,0);
  process.stdout.write(JSON.stringify({episode:scenario.episode,scenes:scenario.scenes.length,narrationWords:words,estimatedSeconds:seconds},null,2)+"\n");
}else{
  throw new Error("Usage: node tools/ep03-v2.mjs [--write|--check|--summary]");
}
