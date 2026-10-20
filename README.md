# ПДД Грузии: учебный сайт (черновик)

Статический сайт (HTML/CSS/JS без сборщика). Не опубликован.

## Запуск локально
```
cd /workspace/pdd_georgia/site
python3 -m http.server 8000
# открыть http://localhost:8000/
```
С `file://` не работает: данные загружаются через `fetch`.

## Пересборка данных
`python3 tools/build.py`. Скрипт читает `../tickets/tickets_ru.json`, `../structure.md`, `../sources/*` и `tools/episodes_src.json` (тексты выпусков: ключевые пункты, ссылки, цитаты), а записывает `data/tickets.json`, `data/episodes.json` и копирует картинки в `img/`.
Видео: `media/epNN.mp4` (видео H.264 скопировано без перекодирования, звук пережат в AAC 96k, `+faststart`), постеры — `media/epNN.jpg`.

## Новый выпуск
1. Положите `media/ep03.mp4` и `media/ep03.jpg`.
2. Добавьте запись в `tools/episodes_src.json`: plan (E-номера), points, quote_refs, ticket_refs.
3. Запустите `python3 tools/build.py`.

## Структура
- `index.html` — выпуски и план E001–E107
- `episode.html?id=ep01` — видео, ключевые пункты, текст закона, билеты
- `practice.html` — самопроверка: все вопросы, тема, серия, ошибки, нерешённые
- `exam.html` — пробный экзамен
- `about.html` — источники и ограничения
- `assets/` — CSS и общий JS; `data/` — JSON; `img/` — картинки к билетам; `media/` — видео; `tools/` — сборка

## Перед публикацией
Сайт выложен на GitHub Pages: https://jenya239.github.io/pdd-georgia/. База вопросов и картинки — teoria.on.ge (официальная база Service Agency).
