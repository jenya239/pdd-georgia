# Журнал итерации ep03/v2

```text
HEAD, branch, changed files:
  ветка cursor/ep03-v2-video-6e59, база origin/main 1c24d61, коммит этой итерации — в сообщении PR после push.
  Новые: engine/*.mjs, tests/js/ep03-v2-geometry.test.mjs, design/prototypes/*, render/preflight.md,
  render/legal-matrix.md, render/stress-prototypes.md, этот журнал.
  package.json: devDependency @resvg/resvg-js ^2.6.2.
  Не тронуты: content/media/ep03.mp4, video/episodes/ep03/scenes.py, boards.py, timeline.json, scenario.json.

Scene IDs delivered:
  Прототипы A2→A3 (S02→S03) и C1→C2 (S07→S08), 22 с каждый, без звука и без плашек.
  Немой S00–S11: render/preview/ep03-v2-silent-preview.mp4.
  Это не принятый мастер и не замена опубликованного ролика. Речь не наложена.

Actual preview paths / contact sheet / video duration:
  design/prototypes/A2-A3-svg.mp4  22.000 с, 528 кадров, 1920×1080, h264, 24/1, без звука
  design/prototypes/A2-A3-cpu.mp4  те же параметры
  design/prototypes/C1-C2-svg.mp4  те же параметры
  design/prototypes/A2-A3-contact.png, C1-C2-contact.png
  stills: A2-A3-stills-svg/, A2-A3-stills-cpu/, C1-C2-stills-svg/
  A2-A3-vehicle-diff.json: pixels 0, t 1 с и 11 с
  svg sha256 55358343b42870ee28ffae2521bdd2a73ee4e963d0969d68861d6ffbb242cecd
  cpu и C — в stress-prototypes.md
  Немой фильм: 206.000 с, 4944 кадра, 1920×1080, h264, 24/1, только видеодорожка, 1.9 МБ.
  sha256 cbcbe342b7a1d478cd4d10fbcea08373954af3b68802c521f9c40e7e99d3f83f
  Один процесс умер по OOM (exit 137) на кадре 1752. Файл собран девятью кусками по ≤600 кадров и ffmpeg concat -c copy.
  Кадры 8 с, 12 с, 96 с, 112 с, 168 с, 178 с, 200 с просмотрены с диска: S00 без проезда и с оговоркой «справа недостаточно»;
  снег без победителя; S06 стоит; автобус не входит в пересечение; 5 м от края; сводка из 8 строк читается и на ширине 375 px.

Legal evidence for changed claims:
  render/legal-matrix.md. Сверка с law_ka_matsne_pub36_2026-06-25 и русским параллельным текстом.
  S06 без победителя: needs-review, scenario.json не переписывался.
  NTSB HWY12MH007 сверен с живой страницей 2026-11-22; кадр символический, needs-review.
  Автор не принимает собственную правовую проверку.

What a silent viewer can infer:
  См. render/stress-prototypes.md. Последний модельный просмотр стабильного A: покрытие растёт около 4 с,
  сначала едет синяя, после полной заливки едет красная, камера неподвижна.
  Это не человеческий тест.

Automated checks and exact statuses:
  node tools/ep03-v2.mjs --check → EP03 v2 generated materials in sync, exit 0
  tests/js/ep03-v2-geometry.test.mjs → 7 pass, 0 fail
  tests/js/ep03-v2-preproduction.test.mjs → 4 pass, 0 fail
  tsc packages/domain, packages/intersection, packages/course → exit 0 после prisma generate
  node tools/visual-editorial-audit.mjs → Visual editorial structure OK: 8/8, exit 0
  node tools/build.mjs --check → exit 0
  node --test tests/js/*.test.mjs → 324 tests, 305 pass, 19 fail.
    3 fail: нет пакета reflect-metadata (apps/api), Postgres не запущен.
    Сверки с Python падают: нет .venv/bin/python.
    Хеши теории ep01–ep03 не сходятся с tests/js/fixtures/*-theory.sha256 уже на HEAD
    (site/lessons/ep03-plain.html даёт 08c47c77… и в рабочем дереве, и в HEAD; фикстура ждёт 91b6e247…).
    Эта ветка файлы урока и site/ не меняла.
  prisma migrate deploy → P1001, нет сервера на /var/run/postgresql:5432, бинарника postgres нет.
  pytest 9.2.0, PYTHONPATH=tools, tests/py tests/video: 232 passed, 2 failed, 6 skipped, 31.54 с.
    Падения не в файлах этой ветки: test_plain_editions_keep_the_statute_and_drop_the_characters (defs == []),
    test_links_report_is_committed_fresh (links.json расходится с живым отчётом Python 3.12).
    6 skipped — каталог tests/video, без отдельного video-venv.
  e2e не запускался: нет playwright и нет .venv.
  edge-tts 7.3.1: одна фраза «Проверка синтеза, без ключа.» → NoAudioReceived, файл 0 байт. Ключ не использовался.
  tools/check.sh целиком не печатал ALL GREEN.

Manual reviewer findings (or NOT YET DONE):
  Модельный стресс — stress-prototypes.md. Человек: NOT YET DONE.

Unresolved blockers:
  Платного ключа TTS в окружении нет. edge-tts не установлен: python3-venv отсутствует, pip-модуль edge_tts не импортируется. Голосовой мастер не собран.
  Нет второго человека на право и на вопросы 1–6.
  S06 остаётся неподвижным.
  Полный ролик, если собран, немой и не синхронизирован с речью.

What changed since previous iteration:
  Первая производственная итерация поверх 1c24d61: модель кадра, два рендера, прототипы, тесты геометрии.

Next smallest verified deliverable:
  Человеческий просмотр двух прототипов. Озвучка — только когда есть рабочий TTS без секрета в репозитории.
```

## Итерация после 6965abb

```text
HEAD, branch, changed files:
  В origin/main влит 6965abb обычным merge, коммит 72b5f01, конфликтов не было.
  Поверх: литературная правка scenario.json, пересобранные SCREENPLAY.md и VOICE.txt,
  tools/ep03-v2.mjs (запрет производственной фразы про победителя),
  render/narrative-review.md, voice/speak.mjs и читка, порядок stoppark перед case в stories.mjs,
  пересобранный немой preview, строки S09/S10 в legal-matrix.md.

Scene IDs delivered:
  Те же S00–S11. В кадре S09 — остановка и стоянка, S10 — NTSB. Речь не наложена на картинку.

Actual preview paths / contact sheet / video duration:
  Прототипы не перекодировались: картинка от новой речи не меняется.
  A2-A3-svg.mp4 sha256 55358343b42870ee28ffae2521bdd2a73ee4e963d0969d68861d6ffbb242cecd, 22.000 с.
  Немой фильм заново: render/preview/ep03-v2-silent-preview.mp4
  206.000 с, 4944 кадра, 1920×1080, h264, 24/1, только видео.
  sha256 ceea6b630abacb7f3ebe76a5d369e641ce5cff0a954bfa37657d0285b1250ca7
  Девять кусков по ≤600 кадров, ffmpeg concat -c copy.
  Кадры с диска: 12 с — оговорка «справа недостаточно», машины стоят;
  96 с — снег, обе «своя — второстепенная», проезда нет;
  112 с — поворот главной, машины стоят, «На главной — ещё не первый»;
  160 с — 5 м от края и отдельный запрет стоянки у выезда;
  176 с — США, 16 февраля 2012, NTSB, автобус южнее пересечения, приписка «схема учебная»;
  200 с — сводка из восьми строк. На ширине 375 px кадры 160 с и 200 с читаются.
  Читка без графики: voice/readthrough.mp3, 481.080 с, 2.7 МБ, mp3 24 кГц, 1 канал.
  mean_volume −20.9 dB, max_volume −3.6 dB. 29/29 фраз.
  edge-tts 7.3.1, ru-RU-SvetlanaNeural, rate +10%, pitch −4Hz.
  Семь фраз сорвались с NoAudioReceived и собрались повтором; у S01.2 отказ был и на второй попытке, затем успех.

Legal evidence for changed claims:
  Новые фразы нормы не добавляют. Матрица приведена к порядку S09 остановка, S10 NTSB.
  Авторская проверка по-прежнему needs-review.

What a silent viewer can infer:
  На 160 с виден запрет остановки у пересечения и отдельно запрет стоянки у двора.
  На 176 с виден учебный кадр американского случая до столкновения.
  Это проверка порядка сцен, не человеческий тест вопросов 1–6.

Automated checks and exact statuses:
  node tools/ep03-v2.mjs --check → in sync, exit 0
  node tools/ep03-v2.mjs --summary → scenes 12, narrationWords 1054, estimatedSeconds 433
  tests/js/ep03-v2-geometry.test.mjs + ep03-v2-preproduction.test.mjs → 11 pass, 0 fail
  tsc domain, intersection, course → exit 0
  node tools/visual-editorial-audit.mjs → Visual editorial structure OK: 8/8, exit 0
  node tools/build.mjs --check → site up to date, exit 0
  node --test tests/js/*.test.mjs → 324 tests, 305 pass, 19 fail
    (reflect-metadata, Postgres ENOENT, нет .venv/bin/python, хеши теории ep01–ep03)
  pytest → 232 passed, 2 failed, 6 skipped, 31.70 с
    (test_lessons.py defs == [], test_normsite.py links.json)
  prisma migrate deploy → P1001, /var/run/postgresql:5432
  e2e не запускался: нет Playwright
  tools/check.sh ALL GREEN не печатает.

Manual reviewer findings (or NOT YET DONE):
  Литературный лист — narrative-review.md. Статус не «одобрено».
  Человек читку и кадры не смотрел: NOT YET DONE. Владелец смотрит сам.

Unresolved blockers:
  Нет второго человека. S06 без вычисленной очереди. Речь не сведена с картинкой:
  читка 481 с, немой ролик 206 с, estimate_s не подгонялся.
  Dmitry +10% с этой VM не звучит. Платного голоса нет.

What changed since previous iteration:
  Слияние 6965abb. Вторая редактура стыков. Читка. Немой черновик в новом порядке сцен.

Next smallest verified deliverable:
  Прослушивание voice/readthrough.mp3 человеком и просмотр двух прототипов.
```

```text
HEAD, branch, changed files:
  ветка cursor/ep03-v2-video-6e59. Коммит этой итерации — после push.
  S06: scenario.json overlay «Не определено», design/worlds.json, render/s06-decision.json,
  tests/js/intersection-solver.test.mjs. Речь S06 не менялась.
  Сведение: engine/master.mjs, engine/review-checks.mjs, engine/frame.mjs, engine/stories.mjs,
  engine/render-clip.mjs, render/timeline.json, render/sources.json,
  render/final/ep03-v2-review.mp4, .srt, ep03-v2-review-report.md.
  Не тронут: content/media/ep03.mp4.

Scene IDs delivered:
  S00–S11 в одном файле со речью. Это обзорный мастер v2, не замена опубликованного ролика.

Actual preview paths / contact sheet / video duration:
  video/episodes/ep03/v2/render/final/ep03-v2-review.mp4
  517.042 с, h264 1920×1080 24/1, aac 48 кГц моно, 13 МБ.
  sha256 0492779bffa5f6c01097c585255802fc739e2c1f882f7f408aad934b52cd55df
  Субтитры: render/final/ep03-v2-review.srt, 98 реплик.
  Контактный лист на 12 сцен не собирался. Открыты кадры 2.4, 40, 75, 100, 120, 136, 155,
  183, 234, 235, 290, 345, 369, 406, 471, 486 с и два кадра шириной 375 px.

Legal evidence for changed claims:
  render/s06-decision.json. Решатель intersection-0.1.0: unsupported / unverified-priority,
  admissible пуст и для прямого проезда, и для левого поворота синей. Очередь не назначена.
  Кадр: «Не определено», along = 0. Независимая правовая приёмка: needs-review.

What a silent viewer can infer:
  На 183 с снег и две подписи «своя — второстепенная», проезда нет.
  На 234 с излом главной и «Не определено», машины стоят.
  На 406 с учебный кадр NTSB до столкновения, приписка под титром.
  Это просмотр отдельных кадров, не ответы на вопросы 1–6.

Automated checks and exact statuses:
  review-checks.mjs: failures [], duration 517.042, phrases 29, cues 98,
  mean −21.2 dB, max −3.5 dB, sceneBreaths 11, longestBreath 4.161 с, blackdetect пусто.
  node tools/ep03-v2.mjs --check → in sync, exit 0
  tests geometry + master + preproduction + intersection-solver → 28 pass, 0 fail
  node tools/visual-editorial-audit.mjs → 8/8, exit 0
  node tools/build.mjs --check → site up to date, exit 0
  prisma migrate deploy → P1001, /var/run/postgresql:5432
  .venv/bin/python нет. playwright не импортируется. e2e не запускался.

Manual reviewer findings (or NOT YET DONE):
  Читка: владелец, 2026-11-23, «да нормально», замечаний нет. Это не вопросы 1–6.
  Просмотр сведённого ролика человеком: NOT YET DONE.

Unresolved blockers:
  Нет ответов на вопросы 1–6. S06 и ориентация 8.13 остаются needs-review.
  Dmitry +10% с этой VM не звучит. tools/check.sh ALL GREEN не печатает:
  нет Postgres, нет .venv, нет Playwright.

What changed since previous iteration:
  Плашка S06 заменена на «Не определено» без правки принятой речи.
  Речь сведена с картинкой по длинам фраз. Приписка NTSB поднята из-под автобуса.

Next smallest verified deliverable:
  Человеческие ответы на вопросы 1–6 по сведённому файлу.
```
