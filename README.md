# ПДД Грузии: учебный сайт, данные и видео

Сайт: https://jenya239.github.io/pdd-georgia/ (GitHub Pages). Один репозиторий: сайт, сборка данных, скрапер и парсер билетов, парсер закона, онтология, генераторы уроков, видеоконвейер, тесты.

## Архитектура

```
content/            ИСХОДНИКИ, которые пишет человек
  episodes.json       выпуски: план (E-номера), ключевые пункты, цитаты, teaches/include/exclude, pitfalls
  lessons/epNN/       генераторы текстовых уроков (lesson.py → HTML; figs.py — SVG-схемы)
  media/              опубликованные видео и постеры выпусков (epNN.mp4/.jpg)
  assets/signs/       картинки знаков (общие для уроков и видео)
  plan/               план курса (structure.md: блоки и E001–E107)
data/               ВНЕШНИЕ ДАННЫЕ, полученные скриптами
  sources/            тексты закона (RU/KA — matsne, ред. 36 от 25.06.2026; EN — офиц. перевод 2019), приложения, КоАП (KA)
  tickets/            база билетов teoria.on.ge (tickets_ru.json, картинки), manual_fixes.json
packages/domain/    доменная логика на чистых ES-модулях (без DOM): прогресс, хранилище, области проверки, ошибки
web/                страницы сайта: *.html (без инлайн-скриптов) + assets/
  assets/app/         общий слой страниц: dom, prefs (язык/тема), data (загрузка JSON), progress, layout, question
  assets/pages/       по одному модулю на страницу (index, episode, check, errors, practice, exam, about)
tools/              сборка и конвейеры данных (Python)
  build.py            точка входа сборки → docs/
  pdd/                чистые функции: assign (билет→урок), episodes, lawparse, plan, lessonkit; build = ввод-вывод
  pdd/tickets/        scrape → parse → fetch_images → build_tickets
  check.sh            все проверки разом
video/              видеоконвейер
  render.py           единая точка входа: python video/render.py epNN [tts|video|all|still T…|sheet]
  engine/             общий движок: core (кадры PIL → ffmpeg), lib (рисование), cast (персонажи, голоса), tts, assemble, subs, music, final.sh
  episodes/epNN/      только своё: scenes.py (сценарий), boards.py (доски), timeline.json
tests/              js (node --test), py (pytest), video (кадры против эталонов), e2e (Playwright)
docs/               СОБРАННЫЙ САЙТ (артефакт сборки, коммитится, его публикует Pages)
ci/test.yml         шаблон workflow GitHub Actions (см. «CI»)
```

Зависимости направлены в одну сторону: `content` + `data` → `tools` → `docs`; страницы (`web/assets/pages`) → `web/assets/app` → `packages/domain`. Доменные модули не знают про DOM и `localStorage`: хранилище подключается адаптером `createStore(backend)` (в браузере `localStorage`, в тестах `memoryBackend()`).

Сборка читает только файлы внутри репозитория (это проверяет `tests/py/test_build.py`).

## Сборка

```
python3 tools/build.py           # пересобрать docs/
python3 tools/build.py --check   # только проверить, что docs/ актуален (ничего не пишет)
python3 tools/build.py --out=DIR # собрать в другую папку
```
Сборка генерирует `docs/data/tickets.json`, `docs/data/episodes.json`, HTML текстовых уроков, копирует страницы, `web/assets`, `packages/domain` (→ `docs/assets/domain/`), картинки билетов (→ `docs/img/`), видео и знаки, пишет `.nojekyll`.

Локальный просмотр: `cd docs && python3 -m http.server 8000` → http://localhost:8000/ (с `file://` не работает — данные грузятся через `fetch`).

## Публикация (GitHub Pages)

Публикуется папка `docs/` ветки `main`. Workflow для деплоя не нужен (у токена нет scope `workflow`).
Чтобы Pages брал сайт из `docs/`, один раз переключите источник:
```
gh api -X PUT repos/jenya239/pdd-georgia/pages -f "source[branch]=main" -f "source[path]=/docs"
```
(или Settings → Pages → Branch: main, folder: /docs). Пока Pages смотрит в корень ветки, корневые `index.html` и `404.html` перенаправляют в `docs/`, в том числе старые ссылки вида `…/pdd-georgia/episode.html?id=ep01`. После переключения корневые файлы просто не публикуются.

## Тесты

```
tools/check.sh                         # всё: node, pytest, build --check, e2e
node --test tests/js                   # доменные модули (Node 18+)
python3 -m pytest -q tests/py          # сборка, назначение билетов, уроки (цитаты дословно из закона), онтология, билеты
python3 -m pytest -q tests/video       # кадры видео пиксель-в-пиксель против tests/video/baseline (пропускается без видео-venv)
python3 tests/e2e/site_e2e.py [--root=docs] [--shots=DIR]   # Playwright, сайт как на Pages (под /pdd-georgia/)
```
Переменные `check.sh`: `PYTHON` (с pytest), `E2E_PYTHON` (с playwright), `VIDEO_PYTHON`, `E2E=0` — пропустить браузер, `E2E_CHANNEL=chromium` — встроенный Chromium вместо Chrome.
Зависимости: `pip install -r requirements-dev.txt`, затем `python -m playwright install chromium`.

### CI
`ci/test.yml` — готовый workflow (node + pytest + build --check + e2e). Он лежит не в `.github/workflows/`, потому что токен без scope `workflow` не может пушить workflow-файлы. Включить: `mkdir -p .github/workflows && cp ci/test.yml .github/workflows/` и запушить токеном со scope `workflow` (или создать файл через веб-интерфейс GitHub).

## Новый выпуск
Выпуск бывает двух видов (`kind` вычисляет сборка):
- **видео** — `content/media/epNN.mp4` и `epNN.jpg`; исходники видео — `video/episodes/epNN/`;
- **текст** — генератор `content/lessons/epNN/lesson.py` с функцией `render()` → фрагмент HTML (маркер `<!--AFTER-TICKETS-->` делит теорию и «наши вопросы»). id внутри SVG обязаны начинаться с `epNN-` (проверяет `tests/py/test_lessons.py`, там же — что все цитаты дословно есть в законе).

Затем добавьте запись в `content/episodes.json` и запустите `python3 tools/build.py`.

### Видео
```
/workspace/.videovenv/bin/python video/render.py ep03 still 52.6   # кадр → video/episodes/ep03/stills/
/workspace/.videovenv/bin/python video/render.py ep03 all          # озвучка (edge-tts) + рендер → final.mp4
```
Результаты рендера (audio/, seg/, stills/, *.mp4) в git не попадают; готовое видео копируется в `content/media/`. Нужны numpy, pillow, matplotlib, edge-tts, ffmpeg и шрифты из `/usr/share/fonts/truetype/sand-box/google/`.

## Билет → урок (поле `lesson`)
У каждого билета не больше одного основного урока. Поле `lesson` вычисляет сборка (`tools/pdd/assign.py`; в `data/tickets/tickets_ru.json` оно не пишется):
1. **Основное правило** билета — первая ссылка на закон (статья, пункт, грузинский подпункт), а если её нет — первый пункт приложения (знак, разметка).
2. Урок — **самый ранний** выпуск, у которого `teaches` покрывает это правило. Спецификации: `"ст. 39"`, `"ст. 39 п. 1"`, `"ст. 34 п. 9 д"`, `"прил. 1 1.1"`.
3. `include` и `exclude` — ручные поправки по номерам билетов. Их добавляют только после проверки, что урок действительно объясняет (или не объясняет) ответ.
4. Билеты, которые не объяснил ни один урок, остаются без `lesson`.

Поле `episodes` (тематические ссылки на билеты) остаётся как было. `pitfalls` — заметки «почему здесь ошибаются» по правилу. Они берутся только из текста урока и показываются только у билетов этого урока (поле `why`).

## Прогресс, накопительная проверка, ошибки
Прогресс хранится только в браузере (`localStorage`):
- `pddge.progress.v1` — по билету: попытки, верные, ошибки, серия верных подряд, дата последней ошибки, выбранные неверные варианты;
- `pddge.runs.v1` — результаты накопительных проверок;
- `pddge.cumrun.v1` — незаконченные проверки;
- `pddge.settings.v1` — настройки.

Страницы:
- `check.html?lesson=epNN` — накопительная проверка: все билеты этого урока и предыдущих. Сначала идут новые билеты, потом прежние вперемешку (порядок можно сменить). Проверку можно продолжить после перезагрузки, есть история результатов.
- `errors.html` — типичные ошибки (рейтинг, по урокам, темам, правилам) и «Разобрать ошибки»: билет считается исправленным после 2 верных ответов подряд.
- Экспорт и импорт прогресса в JSON — на главной и на странице ошибок. При импорте данные сливаются: счётчики складываются, дата берётся у более свежей записи.

## Данные и права
- Тексты закона — matsne.gov.ge (`data/sources/README.md`).
- Билеты и картинки — teoria.on.ge (официальная база Агентства обслуживания); условия On.ge ограничивают перепубликацию, см. `data/tickets/README.md`. Сырой HTML teoria.on.ge в репозиторий не кладётся (`data/tickets/raw/` в `.gitignore`).
