# PDD_NODE_BUILD — 15 шагов: сборка site/ с Python на Node

Состояние очереди: [PDD_NODE_BUILD_STATE.md](PDD_NODE_BUILD_STATE.md). Этот файл — спецификация. Прогресс нигде больше не хранится.

Очередь переносит оркестратор сборки `site/` на Node там, где результат совпадает с сегодняшним Python. Видео, скачивание билетов, разовый перевод, e2e, ep07, тьютор, серии дней, очки и рейтинги сюда не входят.

Шаги взяты из ответа Sonnet `mlc-support/responses/pdd_node_build_plan_20261107_172408.md`. Состав шагов не переставлялся.

## Общие правила

- `STATE` = `docs/agent/PDD_NODE_BUILD_STATE.md`
- `QUEUE` = `docs/agent/PDD_NODE_BUILD_QUEUE.md`
- Один шаг — один ход. Шаг `N` выполняется только если `next_step` равен `N`.
- Сначала тест. Новый код — Node.js. Python не добавлять.
- Чистые функции — `packages/build/**`: без DOM, без чтения файлов, без Prisma. Чтение закона, кэша и запись JSON — `tools/*.mjs`.
- Уже готовые `primaryRef`, `ticketNorms`, `citedNorms` вызывать из `packages/domain/ontology.ts`. Вторую копию не писать. `packages/domain/**` не править.
- Русский разбор ссылки импортировать из `packages/lesson/normref.ts`. Этот файл не править и не копировать.
- Файл кода не длиннее 400 строк. Метод, который не помещается на экран, разбить по ответственности.
- Цитаты закона не переписывать. Id в `tests/py/fixtures/norm_slugs.tsv` не менять и не удалять. `APP_VERSION` и `SCHEMA_VERSION` не поднимать.
- Не писать ep07, тьютор, серии дней, очки, рейтинги. Не создавать `.github/workflows`. Не пушить.
- Не удалять Python-модули, `content/lessons/**/lesson.py`, `figs.py`, `video/**`.
- Расхождение с Python не «исправлять». Не сошлось золотое сравнение — шаг `blocked`, половина не коммитится.
- Коммит шага: `git add` явным списком. Никогда `-A` и `-a`. Сообщение `pdd node build step <N>: <заголовок>`. Без `--trailer`, без push.
- В коммит входят изменённые файлы из `allowed_files` и `STATE`. `QUEUE` не менять.
- Не коммитить `node_modules/`, `.next/`, `generated/prisma/`, `.env`, `.env.*`.
- `F0`, если шаг или ответ Sonnet прямо не назвал путь: `.github/workflows/**`, `content/lessons/**`, `video/**`, `packages/domain/**`, `packages/lesson/normref.ts`, `packages/norm/**`, `tests/py/fixtures/norm_slugs.tsv`, `tools/pdd/build.py`.
- Gate запускать точно той командой, которая записана в шаге. Node брать так: `export PATH="$HOME/.nvm/versions/node/v24.22.1/bin:$PATH"`.

## Протокол состояния

Восемь полей, формат `ключ: значение`. Значения `status`: `ready`, `in_progress`, `consulting`, `consult_ready`, `blocked`, `queue_complete`.

- Начало обычного хода: `status: in_progress`, остальные поля не менять.
- Gate прошёл: `current_step: <N>`, `last_result: done step <N>: <одна строка>`, `last_verify: <команда> => <наблюдаемый исход>`, `next_step: <N+1>`, `status: ready`, `consult_count: 0`, `consult_response:` пусто, `consult_verdict:` пусто. После шага 15: `status: queue_complete`, `next_step: none`.
- Gate не прошёл: `next_step` не меняется, `consult_count` не меняется, `status: blocked`, `last_result: blocked step <N>: <причина>`, `last_verify: <команда> => <первые строки вывода>`. Код не коммитить. Sonnet в этом ходе не вызывать.
- `status: in_progress` на входе — тот же `next_step` выполняется заново.
- `status: consulting` на входе — повторить только консультацию, код шага не трогать.

## Консультация при остановке

Sonnet только через `ruby /home/jenya/workspaces/current/mlc-support/review_pdd_node_build_consult.rb`. Субагента Cursor не вызывать. Скрипт не применяет патч и не пишет в дерево курса.

На один номер шага — один платный ответ о шаге. Если он или провал gate ведёт к остановке, следом один ответ «проверка основания». `over_budget` ждёт человека. Потолок — оценка первого вызова `$1.50`.

Ход консультации (вход: `blocked` и `consult_count: 0`, либо `consulting` без строки `kind: grounds`):

1. Записать `status: consulting`. Код шага не менять.
2. Перезаписать `/home/jenya/workspaces/current/mlc-support/steps/pdd_node_build_consult.md`. Первая строка `step: <N>`. Дальше текст шага, `last_result`, `last_verify` и секция `## Files` из `allowed_files`.
3. Запустить скрипт с `--dry-run`. Exit 2 или строка `consult_over_budget`: `consult_count: 1`, `consult_verdict: over_budget`, `status: blocked`. Остановиться.
4. Иначе тот же скрипт без флага. Успех — строка `consult_response: <путь>`. Записать путь, `consult_count: 1`, `consult_verdict:` пусто, `status: consult_ready`. Закоммитить только `STATE`. Остановиться.

Следующий ход видит `consult_ready`. Ответ начинается с `consult_step: <N>`. Строка `verdict:` — `retry`, `patch` или `human`.

- `human` или пустой verdict — `status: blocked`, `consult_verdict: human`, код не менять, остановиться. Следующий ход выполняет проверку основания.
- `retry` или `patch` — один раз выполнить шаг по совету. Файл, который совет прямо назвал, можно менять, в том числе вне `allowed_files`. Файл, который совет не назвал, не трогать. Успех gate — обычное продвижение. Провал — `blocked`, `consult_count` остаётся 1, `consult_verdict: human`.

## Проверка основания остановки

Вопрос: останавливает достаточное основание или само правило. Тот же скрипт. В запросе вторая строка `kind: grounds`. Ответ шага не переиспользуется.

Вход: `status: blocked`, `consult_count: 1`, `consult_verdict` не `stop` и не `over_budget`. Либо `status: consulting`, и в consult-файле уже есть `kind: grounds`.

1. Записать `status: consulting`.
2. Перезаписать consult-файл. Строки `step: <N>` и `kind: grounds`, затем `last_result`, `last_verify`, `consult_verdict`, путь прошлого ответа и цитата правила, из-за которого ход остановился.
3. `--dry-run`, затем скрипт без флага. Exit 2 — `consult_count: 2`, `consult_verdict: over_budget`, `status: blocked`. Остановиться.
4. Успех — `consult_count: 2`, `status: consult_ready`, закоммитить только `STATE`. Остановиться.

Следующий ход читает первую строку `consult_step: <N> grounds`.

- `verdict: stop` или пустой verdict — если совет прямо называет файлы и правку, выполнить её один раз. Иначе `consult_verdict: stop`, `status: blocked`, остановиться.
- `verdict: amend` — один раз выполнить названную правку. Шаг `next_step` в этом ходе не начинать. Затем `consult_count: 0`, поля консультации пустые, `status: ready`, `next_step` не менять. Коммит названных файлов и `STATE`. Сообщение `pdd node build step <N>: правка правила остановки`.

`consult_verdict: over_budget` — API не вызывать, шаг не повторять. `consult_verdict: stop` — API не вызывать; если сохранённый ответ прямо называет правку, выполнить её один раз.

## Шаблон шага

Поля: `goal`, `allowed_files`, `contract`, `gate`, `done_when`.

## Шаг 1

- goal: золотой хелпер сравнения с Python и сериализатор JSON в формате `build.py`.
- allowed_files: `packages/build/pyjson.ts`, `tests/js/helpers/golden.mjs`, `tests/js/build-pyjson.test.mjs`, `STATE`
- contract: `build.py`, `site/` и `APP_VERSION` не менять. Оракул — байты `site/data/tickets.json`, `site/data/items.json`, `site/data/episodes.json`. Сериализатор повторяет порядок ключей, отступы, `ensure_ascii`, разделители, перевод строки в конце и запись чисел как у Python. Сортировка ключей идёт по кодпоинтам, не по UTF-16. Хелпер только читает результат Python.
- gate: `node --test tests/js/build-pyjson.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. Пересериализация каждого текущего `site/data/*.json` даёт те же байты. Заголовок: `golden-хелпер и Python-совместимый JSON`.

## Шаг 2

- goal: план курса и списки билетов выпуска совпадают с `plan.py` и `episodes.py`.
- allowed_files: `packages/build/plan.ts`, `packages/build/episodes.ts`, `tools/build-episodes.mjs`, `tests/js/build-episodes.test.mjs`, `STATE`
- contract: не менять `plan.py`, `episodes.py`, `test_plan.py`, `test_episodes.py`. Оракул — `site/data/episodes.json` побайтно. Функции чистые.
- gate: `node --test tests/js/build-episodes.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. Байты `episodes.json` равны. Заголовок: `план и выпуски episodes.json`.

## Шаг 3

- goal: разбор русского закона и приложений даёт те же структуры, что `lawparse.py`.
- allowed_files: `packages/build/law-ru.ts`, `tools/build-law.mjs`, `tests/js/build-law-ru.test.mjs`, `STATE`
- contract: чистая функция получает строку. Файл читает `tools/build-law.mjs`. Грузинский и английский разбор не трогать. Тексты цитат не менять. Оракул — дамп русской части из Python, снятый хелпером шага 1.
- gate: `node --test tests/js/build-law-ru.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. Число и порядок русских фрагментов и приложений равны. Заголовок: `разбор русского закона`.

## Шаг 4

- goal: грузинский и английский разбор закона совпадает с Python.
- allowed_files: `packages/build/law-ka-en.ts`, `tools/build-law.mjs`, `tests/js/build-law-ka-en.test.mjs`, `STATE`
- contract: не менять `law-ru.ts`. Расхождение не исправлять. Оракул — дамп Python по ka и en.
- gate: `node --test tests/js/build-law-ka-en.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. Дамп ka и en равен, сравнение по полям без допусков. Заголовок: `разбор грузинского и английского закона`.

## Шаг 5

- goal: список норм и их id совпадают с `norms.py` и замороженным `norm_slugs.tsv`.
- allowed_files: `packages/build/norms.ts`, `tools/build-norms.mjs`, `tests/js/build-norms.test.mjs`, `STATE`
- contract: `tests/py/fixtures/norm_slugs.tsv` только читать, не менять. Каждый id из tsv присутствует и совпадает. Новые id допустимы только дописыванием в конец, и только если их создаёт и Python. Оракул — список норм из Python и tsv.
- gate: `node --test tests/js/build-norms.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. В выводе все строки tsv найдены, лишних нет. Заголовок: `список норм и сверка id`.

## Шаг 6

- goal: запись билета без отдельного пересчёта хеша совпадает с `ticketdata.py` и `assign.py`.
- allowed_files: `packages/build/ticket-record.ts`, `tools/build-tickets.mjs`, `tests/js/build-tickets.test.mjs`, `STATE`
- contract: `primaryRef`, `ticketNorms`, `citedNorms` вызывать из `packages/domain/ontology.ts`, второй копии не делать. Хеш не пересчитывать своим кодом: брать из `packages/domain/ticket-hash.ts` или из уже записанного значения. Машинный перевод не подставлять. Оракул — билеты в `site/data/tickets.json` побайтно, поле перевода исключено из сравнения этого шага.
- gate: `node --test tests/js/build-tickets.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. Все билеты равны с учётом хеша. Заголовок: `запись билета без перевода`.

## Шаг 7

- goal: подстановка перевода из `content/translations/explanations_ru.json` совпадает с `mt.py`.
- allowed_files: `packages/build/mt-apply.ts`, `tools/build-tickets.mjs`, `tests/js/build-mt.test.mjs`, `STATE`
- contract: только чтение кэша. Без сети, без пакета `translators`, без `translate_ka.py`. Отсутствующий ключ кэша обрабатывается как в `mt.py`. Оракул — билеты в `site/data/tickets.json` целиком, уже с переводом.
- gate: `node --test tests/js/build-mt.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. Билеты побайтно равны. Заголовок: `подстановка перевода из кэша`.

## Шаг 8

- goal: `site/data/items.json` совпадает с `checkitems.py`.
- allowed_files: `packages/build/items.ts`, `tools/build-items.mjs`, `tests/js/build-items.test.mjs`, `STATE`
- contract: использовать Node-`World` из `packages/domain/ontology.ts`. Второй `World` не строить. Правила проверки не менять. Оракул — `items.json` побайтно и тексты ошибок проверки.
- gate: `node --test tests/js/build-items.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. `items.json` равен. Заголовок: `экспорт вопросов items.json`.

## Шаг 9

- goal: разборы и поле `br` совпадают с `breakdowns.py`.
- allowed_files: `packages/build/breakdowns.ts`, `tools/build-breakdowns.mjs`, `tests/js/build-breakdowns.test.mjs`, `STATE`
- contract: цитаты закона и id норм не менять. Оракул — поле `br` во всех записях `site/data/tickets.json` побайтно.
- gate: `node --test tests/js/build-breakdowns.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. Все `br` равны. Заголовок: `разборы и поле br`.

## Шаг 10

- goal: поиск и разрешение ссылок на нормы выдаёт те же вхождения, что `normref.py`.
- allowed_files: `packages/build/normref-ka.ts`, `packages/build/normref-find.ts`, `tests/js/build-normref.test.mjs`, `STATE`
- contract: русскую часть брать из `packages/lesson/normref.ts` (`findRu`, `resolveRu`) импортом. Файл не править и не копировать. Грузинский разбор не улучшать. Только поиск, без записи в текст и без `links.json`. Оракул — список вхождений (позиция, норма) по всем текстам, снятый с Python.
- gate: `node --test tests/js/build-normref.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. Вхождения равны по всему корпусу, расхождений 0. Заголовок: `поиск ссылок на нормы`.

## Шаг 11

- goal: расстановка автоссылок в текстах и `links.json` совпадают с `normlink.py`.
- allowed_files: `packages/build/normlink.ts`, `tools/build-links.mjs`, `tests/js/build-links.test.mjs`, `STATE`
- contract: использовать код шага 10 без копий. Оракул — `content/ontology/generated/links.json` и тексты билетов побайтно. Если расхождение осталось, шаг блокируется и в сборку не включается. Python-линковка остаётся, пока блокер не снят.
- gate: `node --test tests/js/build-links.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. `links.json` равен. Заголовок: `автоссылки и links.json`.

## Шаг 12

- goal: обратные ссылки норм совпадают с ядром `Site.html_model` в `normsite.py`.
- allowed_files: `packages/build/backlinks.ts`, `tests/js/build-backlinks.test.mjs`, `STATE`
- contract: чистая функция. Вход — билеты, уроки и нормы из шагов 5, 6 и 11. Оракул — обратные ссылки из модели Python, включая порядок. `packages/norm/**` не менять.
- gate: `node --test tests/js/build-backlinks.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. Списки обратных ссылок равны для каждой нормы. Заголовок: `модель обратных ссылок`.

## Шаг 13

- goal: `tools/render-norm-pages.mjs` берёт модель страниц у Node, байты страниц норм не меняются.
- allowed_files: `packages/build/html-model.ts`, `tools/render-norm-pages.mjs`, `tests/js/build-html-model.test.mjs`, `STATE`
- contract: HTML-шаблоны `packages/norm/**` не менять. Оракул — страницы норм, указатель и chunks побайтно. Python-путь остаётся рабочим, пока не переключена точка входа.
- gate: `node --test tests/js/build-html-model.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. Все страницы норм равны. Заголовок: `страницы норм без Python-модели`.

## Шаг 14

- goal: `node tools/build.mjs` собирает весь `site/` и умеет `--check`, результат равен Python.
- allowed_files: `tools/build.mjs`, `packages/build/static-copy.ts`, `tests/js/build-all.test.mjs`, `STATE`
- contract: только вызывает готовые куски шагов 2–13 и копирует статику. `tools/pdd/build.py` и `tools/check.sh` не менять. Оракул — дерево `site/` после Python побайтно, перечень файлов равен. `.github` не создавать.
- gate: `node --test tests/js/build-all.test.mjs`
- done_when: exit 0 и в stdout есть `fail 0`. Сравнение деревьев: 0 различий, `--check` даёт exit 0. Заголовок: `оркестратор build.mjs`.

## Шаг 15

- goal: `tools/check.sh` запускает `node tools/build.mjs` вместо `tools/pdd/build.py`.
- allowed_files: `tools/check.sh`, `STATE`
- contract: Python-файлы, `lesson.py`, `figs.py` и `video/**` не удалять. Версии и id не менять. `tests/e2e/site_e2e.py` не трогать. Переключать только когда шаги 1–14 уже в коммитах.
- gate: `PYTHON=.venv/bin/python E2E_CHANNEL=chromium tools/check.sh`
- done_when: exit 0 и последняя строка `ALL GREEN`. В прогоне видны pytest, `build.mjs --check` и e2e. Заголовок: `check.sh на Node-сборке`. После этого шага `status: queue_complete`, `next_step: none`.

## Decision log

- 2026-11-07. Очередь собрана по ответу Sonnet `responses/pdd_node_build_plan_20261107_172408.md`, модель `claude-sonnet-5-5`. Первый вызов с лимитом 8000 токенов вернул пустой файл: бюджет ушёл на рассуждение. Рабочий ответ — второй вызов, около $0.12.
- Состав и порядок 15 шагов оставлены как в ответе. В ответе оборваны отдельные строки; поля восстановлены по соседним полям того же шага: шаг 1 (`APP_VERSION`), шаг 3 (кто читает файл), шаг 5 (имя теста `build-norms`), шаг 7 (склеенные gate и done_when), шаг 10 (обрыв после «не улучшать»), шаг 12 (`done_when`), шаг 15 (`allowed_files` — только `tools/check.sh` и `STATE`).
- Файлы очереди написаны до старта, поэтому из шага 1 убраны `PDD_NODE_BUILD_QUEUE.md` и `STATE` как цель шага. `STATE` по-прежнему коммитится каждым шагом.
- `norm_slugs.tsv` в шаге 5 только читается и в `allowed_files` не входит.
- Оракул JSON — файлы `site/data/`, которые пишет текущая сборка. Отдельного каталога `data/*.json` у билетов нет.

## Идентичный промпт очереди

```
Ты исполнитель очереди PDD_NODE_BUILD (курс ПДД Грузии, каталог /home/jenya/workspaces/current/pdd). Один ход — один шаг. Прогресс хранится только в docs/agent/PDD_NODE_BUILD_STATE.md. Спецификация — docs/agent/PDD_NODE_BUILD_QUEUE.md. Отвечай по-русски.

1. Прочитай STATE и в QUEUE разделы «Общие правила», «Протокол состояния», «Консультация при остановке», затем целиком шаг с номером next_step.
2. Если status равен queue_complete — ответь одной строкой «очередь завершена» и остановись.
3. Если current_step больше 0, команда `git log --oneline -1 --grep "^pdd node build step <current_step>:"` обязана найти коммит. Не нашла — status blocked, consult_count не меняй, last_result «нет коммита шага <current_step>», остановись. Sonnet не вызывай.
4. Если status равен blocked и consult_verdict равен over_budget — API не вызывай, шаг не повторяй, остановись. Если status равен blocked и consult_verdict равен stop — API не вызывай. Прочитай consult_response. Если совет прямо называет файлы и правку, выполни её один раз. Файл, который совет не назвал, не трогай. Если такой правки нет — остановись. Если status равен blocked и consult_count равен 1, а consult_verdict не stop — код не правь. Выполни «Проверку основания остановки» и остановись.
5. Если status равен consulting, или status равен blocked и consult_count равен 0 — код не правь. Sonnet только через `ruby /home/jenya/workspaces/current/mlc-support/review_pdd_node_build_consult.rb`: сначала `--dry-run`, затем тот же скрипт без флага, если dry-run не вернул exit 2. Субагента Cursor и другую модель не вызывай. Патч из ответа не применяй в этом ходе.
6. Если status равен consult_ready — прочитай consult_response. Выполни то, что раздел консультации в QUEUE велит для этого verdict. Файл, который совет не назвал, не трогай.
7. Иначе запиши в STATE `status: in_progress` и выполни ровно шаг next_step.
8. Правь только allowed_files этого шага. Сначала тест. Файл не длиннее 400 строк. Новый код — Node.js, не Python. Чистые функции — packages/build, без файлов и без Prisma. Prisma не попадает в packages/domain. Цитаты закона не переписывать. Id норм из tests/py/fixtures/norm_slugs.tsv не менять и не удалять. Не поднимать APP_VERSION. Не писать ep07, тьютор, серии дней, очки, рейтинги. Не создавать .github/workflows и не пушить. Python-модули, lesson.py, figs.py и video не удалять.
9. Запусти gate точно как записано в шаге. Gate прошёл: обнови STATE (current_step = N, status ready, consult_count 0, consult_response и consult_verdict пустые, last_result одной строкой, last_verify — команда и наблюдаемый исход, next_step = N+1). После шага 15: status queue_complete, next_step none. Закоммить только файлы шага и STATE явным списком. Сообщение `pdd node build step <N>: <заголовок>`. Без --trailer, без push.
10. Gate не прошёл: next_step и consult_count не меняй, status blocked, в last_result причина, в last_verify упавшая команда и первые строки вывода. Код не коммить. Sonnet в этом ходе не вызывай.
11. Один шаг за ход. После коммита, консультации или blocked остановись. В ответе: номер шага, команда gate или путь consult_response, исход.
```
