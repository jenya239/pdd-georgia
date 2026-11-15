# ep04 — интеграция

Опубликованный урок сохранён. Внесены только подтверждённые правки.

## Файлы

- `content/lessons/ep04/plain.mjs` — предложение и дословная цитата ст. 39, п. 1 «е».
- `packages/lesson/ep04-figs.ts` — «На одном уровне».
- `content/episodes.json` — памятка и `video_note` про потолок категории B. Поле `teaches` не расширялось, чтобы не переназначить билеты.
- `video/episodes/ep04/scenes.py`, `boards.py` — потолок 33.7 и проезд без остановки.
- `video/episodes/ep04-tickets/scenes.py`, `boards.py` — билет 441; голос `n`.
- `content/ontology/generated/links.json`, `site/` — пересобраны `node tools/build.mjs`.
- `tests/js/fixtures/ep04-theory.sha256` — хеш, который посчитал тест после сборки.

## Команды

`PATH` с Node 24.22.2:

- `node --test tests/js/lesson-quotes.test.mjs tests/js/lesson-theory-hash.test.mjs tests/js/build-links.test.mjs` — зелёные после сборки.
- `node tools/build.mjs` и `node tools/build.mjs --check` — `site: up to date`.
- Скрипты: `editorial-runs/script-check.json`, поле `fail` после правки ep01 и голоса билетов ep04.

`tools/check.sh` целиком в этой среде не доведён до `ALL GREEN`: нет локальной PostgreSQL для `prisma migrate deploy` и отдельного видеоокружения. Это ограничение машины, не отказ сборки сайта.

## Медиа

Mp4 не пересобирались. Pillow нет, кадры не открывались.
