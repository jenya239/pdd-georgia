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
