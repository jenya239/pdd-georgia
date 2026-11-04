# PDD_PLATFORM — 12 шагов: выпуск в базе, журнал, урок и нормы на Node

Состояние очереди: [PDD_PLATFORM_STATE.md](PDD_PLATFORM_STATE.md). Этот файл — спецификация. Прогресс нигде больше не хранится.

Очередь доводит платформу до момента, когда новый урок можно писать на Node, а страницы уроков и норм собираются без Python. Состав ep07, тьютор, серии дней, очки и рейтинги сюда не входят.

## Общие правила

- `STATE` = `docs/agent/PDD_PLATFORM_STATE.md`
- `QUEUE` = `docs/agent/PDD_PLATFORM_QUEUE.md`
- Один шаг — один ход. Шаг `N` выполняется только если `next_step` равен `N`.
- Сначала тест. Новый код — Node.js. Python не добавлять. Prisma не импортировать в `packages/domain`.
- Файл кода не длиннее 400 строк. Метод, который не помещается на экран, разбить по ответственности.
- Цитаты закона не переписывать. Id в `tests/py/fixtures/norm_slugs.tsv` не менять и не удалять. `APP_VERSION` не поднимать.
- Не писать ep07, тьютор, серии дней, очки, рейтинги. Не создавать `.github/workflows`. Не пушить.
- Коммит шага: `git add` явным списком. Никогда `-A` и `-a`. Сообщение `pdd platform step <N>: <заголовок>`. Без `--trailer`, без push.
- В коммит входят изменённые файлы из `allowed_files` и `STATE`. `QUEUE` — только если шаг дописывает Decision log.
- Не коммитить `node_modules/`, `.next/`, `generated/prisma/`, `.env`, `.env.*`.
- `F0`, если шаг или ответ Sonnet прямо не назвал путь: `.github/workflows/**`, `content/lessons/**`, `video/**`, `packages/domain/**`, `tests/py/fixtures/norm_slugs.tsv`.
- Gate запускать точно той командой, которая записана в шаге. Node брать так: `export PATH="$HOME/.nvm/versions/node/v24.22.1/bin:$PATH"`.

## Протокол состояния

Восемь полей, формат `ключ: значение`. Значения `status`: `ready`, `in_progress`, `consulting`, `consult_ready`, `blocked`, `queue_complete`.

- Начало обычного хода: `status: in_progress`, остальные поля не менять.
- Gate прошёл: `current_step: <N>`, `last_result: done step <N>: <одна строка>`, `last_verify: <команда> => <наблюдаемый исход>`, `next_step: <N+1>`, `status: ready`, `consult_count: 0`, `consult_response:` пусто, `consult_verdict:` пусто. После шага 12: `status: queue_complete`, `next_step: none`.
- Gate не прошёл: `next_step` не меняется, `consult_count` не меняется, `status: blocked`, `last_result: blocked step <N>: <причина>`, `last_verify: <команда> => <первые строки вывода>`. Код не коммитить. Sonnet в этом ходе не вызывать.
- `status: in_progress` на входе — тот же `next_step` выполняется заново.
- `status: consulting` на входе — повторить только консультацию, код шага не трогать.

## Консультация при остановке

Sonnet только через `ruby /home/jenya/workspaces/current/mlc-support/review_pdd_platform_consult.rb`. Субагента Cursor не вызывать. Скрипт не применяет патч и не пишет в дерево курса.

На один номер шага — один платный ответ о шаге. Если он или провал gate ведёт к остановке, следом один ответ «проверка основания». `over_budget` ждёт человека. Потолок — оценка первого вызова `$1.50`.

Ход консультации (вход: `blocked` и `consult_count: 0`, либо `consulting` без строки `kind: grounds`):

1. Записать `status: consulting`. Код шага не менять.
2. Перезаписать `/home/jenya/workspaces/current/mlc-support/steps/pdd_platform_consult.md`. Первая строка `step: <N>`. Дальше текст шага, `last_result`, `last_verify` и секция `## Files` из `allowed_files`.
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
- `verdict: amend` — один раз выполнить названную правку. Шаг `next_step` в этом ходе не начинать. Затем `consult_count: 0`, поля консультации пустые, `status: ready`, `next_step` не менять. Коммит названных файлов и `STATE`. Сообщение `pdd platform step <N>: правка правила остановки`.

`consult_verdict: over_budget` — API не вызывать, шаг не повторять. `consult_verdict: stop` — API не вызывать; если сохранённый ответ прямо называет правку, выполнить её один раз.

## Шаблон шага

Поля: `goal`, `allowed_files`, `contract`, `gate`, `done_when`.

## Шаг 1

- goal: закоммитить уже написанный шов. Выпуск лежит в PostgreSQL, dev-сервер отдаёт три JSON из базы, страница Next показывает билет № 1.
- allowed_files: `.gitignore`, `AGENTS.md`, `README.md`, `history/decisions.md`, `package.json`, `package-lock.json`, `tools/check.sh`, `tools/dev-server.mjs`, `tools/load-release.mjs`, `prisma/**`, `prisma7.config.ts`, `packages/course/**`, `apps/web/package.json`, `apps/web/package-lock.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`, `apps/web/src/**`, `tests/js/devserver.test.mjs`, `tests/js/course-source.test.mjs`, `tests/js/documents.test.mjs`, `tests/js/release.test.mjs`, `tests/js/ticket-face.test.mjs`, `STATE`, `QUEUE`
- contract: новый код в этом шаге не писать. Не добавлять `node_modules`, `.next`, `generated/prisma`, `.env`.
- gate: `PYTHON=.venv/bin/python E2E_CHANNEL=chromium tools/check.sh`
- done_when: exit 0 и последняя строка stdout `ALL GREEN`. Заголовок коммита: `выпуск в базе и страница билета`.

## Шаг 2

- goal: приложение Nest в `apps/api` читает тот же выпуск. Тест сравнивает хеш билета № 1 с `26ab70a7e00969e1`.
- allowed_files: `apps/api/**`, `tests/js/api-release.test.mjs`, `STATE`
- contract: Nest 11. Маршрутов журнала нет. Чтение выпуска идёт через `packages/course`, не через файл `site/data`. Сервер в gate не поднимать.
- gate: `node --test tests/js/api-release.test.mjs`
- done_when: exit 0 и в stdout есть `26ab70a7e00969e1`. Заголовок: `Nest читает хеш билета 1`.

## Шаг 3

- goal: одно событие схемы 4 пишется и читается. Повтор с тем же id не создаёт вторую строку. Освоение в тесте считает домен, не SQL.
- allowed_files: `apps/api/src/**`, `tests/js/api-journal.test.mjs`, `packages/course/store.ts`, `STATE`
- contract: ученик в тесте `platform-step-3`. В `finally` удалить его попытки. `SCHEMA_VERSION` не менять.
- gate: `node --test tests/js/api-journal.test.mjs`
- done_when: exit 0. Заголовок: `журнал попытки пишется один раз`.

## Шаг 4

- goal: импорт браузерного журнала схемы 4 в ту же таблицу. Повторный импорт не удваивает попытки.
- allowed_files: `apps/api/src/**`, `tests/js/api-import.test.mjs`, `tests/js/fixtures/schema4-import.json`, `STATE`
- contract: фикстура — минимальный файл схемы 4 с двумя событиями. Ученик `platform-step-4`, удалить в `finally`.
- gate: `node --test tests/js/api-import.test.mjs`
- done_when: exit 0. Заголовок: `импорт схемы 4 не удваивает попытки`.

## Шаг 5

- goal: страница Next показывает число попыток ученика из базы.
- allowed_files: `packages/course/attempt-summary.ts`, `apps/web/src/**`, `tests/js/attempt-summary.test.mjs`, `STATE`
- contract: чистая функция считает события. Страница берёт журнал через `packages/course`. Панель «после ответа» не переносить. Ученик на странице задаётся запросом `learner`.
- gate: `node --test tests/js/attempt-summary.test.mjs`
- done_when: exit 0. Заголовок: `страница показывает число попыток`.

## Шаг 6

- goal: снять эталон теории ep04. Код рендера не менять.
- allowed_files: `tests/js/lesson-theory-hash.test.mjs`, `tests/js/fixtures/ep04-theory.sha256`, `STATE`
- contract: хеш sha256 от байт `site/lessons/ep04.html` до маркера `<!--AFTER-TICKETS-->`. Источники урока и `site/` не править.
- gate: `node --test tests/js/lesson-theory-hash.test.mjs`
- done_when: exit 0 и в stdout есть `ep04`. Заголовок: `эталон теории ep04`.

## Шаг 7

- goal: Node отдаёт тот же фрагмент теории ep04, что уже собранный HTML. Python остаётся эталоном.
- allowed_files: `packages/lesson/**`, `tests/js/lesson-theory-hash.test.mjs`, `STATE`
- contract: функция не вызывает Python. Текст закона внутри фрагмента не переписывать. Если без правки `content/lessons/**` фрагмент не повторить — `blocked`, половину не коммитить.
- gate: `node --test tests/js/lesson-theory-hash.test.mjs`
- done_when: exit 0 и хеш Node-фрагмента равен фикстуре шага 6. Заголовок: `Node повторяет теорию ep04`.

## Шаг 8

- goal: тот же эталон и тот же Node-рендер для ep01–ep06.
- allowed_files: `packages/lesson/**`, `tests/js/lesson-theory-hash.test.mjs`, `tests/js/fixtures/ep0*-theory.sha256`, `STATE`
- contract: общий рендер, не шесть копий. Видео ep01–ep03 не перекодировать. Диалоги ep04–ep06 не переписывать.
- gate: `node --test tests/js/lesson-theory-hash.test.mjs`
- done_when: exit 0 и в stdout есть `ep01` … `ep06`. Заголовок: `Node повторяет теорию ep01–ep06`.

## Шаг 9

- goal: Node отдаёт текст нормы `st36-p4-v` так же, как `site/norm/st36-p4-v.html`.
- allowed_files: `packages/norm/**`, `tests/js/norm-page.test.mjs`, `STATE`
- contract: сравнивать текст нормы, не весь каркас страницы. Id в `norm_slugs.tsv` не трогать. `site/norm` не перезаписывать.
- gate: `node --test tests/js/norm-page.test.mjs`
- done_when: exit 0 и в stdout есть `st36-p4-v`. Заголовок: `Node повторяет норму st36-p4-v`.

## Шаг 10

- goal: Node отдаёт текст каждой нормы, для которой уже есть `site/norm/<id>.html`, кроме `index.html`.
- allowed_files: `packages/norm/**`, `tests/js/norm-page.test.mjs`, `STATE`
- contract: множество id совпадает с файлами. Расхождение одного id — `blocked`, не пропускать его молча.
- gate: `node --test tests/js/norm-page.test.mjs`
- done_when: exit 0 и в stdout есть `norm_pages ids=` и число. Заголовок: `Node повторяет все страницы норм`.

## Шаг 11

- goal: сборка уроков и норм идёт через Node. Поведение сайта не меняется.
- allowed_files: `tools/**`, `packages/lesson/**`, `packages/norm/**`, `tests/js/lesson-theory-hash.test.mjs`, `tests/js/norm-page.test.mjs`, `site/**`, `STATE`
- contract: Python остаётся у e2e и видео. Новых файлов Python не добавлять. `site/` обновить только тем, что произвела сборка.
- gate: `PYTHON=.venv/bin/python E2E_CHANNEL=chromium tools/check.sh`
- done_when: exit 0 и последняя строка `ALL GREEN`. Заголовок: `сборку уроков и норм ведёт Node`.

## Шаг 12

- goal: записать, что публикацию Pages включает человек. Файл workflow не создавать.
- allowed_files: `STATE`
- contract: убедиться, что `ci/pages.yml` есть, а `.github/workflows/pages.yml` нет. Ничего не копировать и не пушить.
- gate: `test -f ci/pages.yml && test ! -f .github/workflows/pages.yml`
- done_when: exit 0. `last_result` включает фразу `скопировать ci/pages.yml в .github/workflows через веб-интерфейс GitHub`. `status: queue_complete`, `next_step: none`. Коммитить нечего, кроме `STATE`, если он изменился. Заголовок, если коммит есть: `публикация Pages остаётся за человеком`.

## Decision log

## Идентичный промпт очереди

```
Ты исполнитель очереди PDD_PLATFORM (курс ПДД Грузии, каталог /home/jenya/workspaces/current/pdd). Один ход — один шаг. Прогресс хранится только в docs/agent/PDD_PLATFORM_STATE.md. Спецификация — docs/agent/PDD_PLATFORM_QUEUE.md. Отвечай по-русски.

1. Прочитай STATE и в QUEUE разделы «Общие правила», «Протокол состояния», «Консультация при остановке», затем целиком шаг с номером next_step.
2. Если status равен queue_complete — ответь одной строкой «очередь завершена» и остановись.
3. Если current_step больше 0, команда `git log --oneline -1 --grep "^pdd platform step <current_step>:"` обязана найти коммит. Не нашла — status blocked, consult_count не меняй, last_result «нет коммита шага <current_step>», остановись. Sonnet не вызывай.
4. Если status равен blocked и consult_verdict равен over_budget — API не вызывай, шаг не повторяй, остановись. Если status равен blocked и consult_verdict равен stop — API не вызывай. Прочитай consult_response. Если совет прямо называет файлы и правку, выполни её один раз. Файл, который совет не назвал, не трогай. Если такой правки нет — остановись. Если status равен blocked и consult_count равен 1, а consult_verdict не stop — код не правь. Выполни «Проверку основания остановки» и остановись.
5. Если status равен consulting, или status равен blocked и consult_count равен 0 — код не правь. Sonnet только через `ruby /home/jenya/workspaces/current/mlc-support/review_pdd_platform_consult.rb`: сначала `--dry-run`, затем тот же скрипт без флага, если dry-run не вернул exit 2. Субагента Cursor и другую модель не вызывай. Патч из ответа не применяй в этом ходе.
6. Если status равен consult_ready — прочитай consult_response. Выполни то, что раздел консультации в QUEUE велит для этого verdict. Файл, который совет не назвал, не трогай.
7. Иначе запиши в STATE `status: in_progress` и выполни ровно шаг next_step.
8. Правь только allowed_files этого шага. Сначала тест. Файл не длиннее 400 строк. Новый код — Node.js, не Python. Prisma не попадает в packages/domain. Цитаты закона не переписывать. Id норм из tests/py/fixtures/norm_slugs.tsv не менять и не удалять. Не поднимать APP_VERSION. Не писать ep07, тьютор, серии дней, очки, рейтинги. Не создавать .github/workflows и не пушить.
9. Запусти gate точно как записано в шаге. Gate прошёл: обнови STATE (current_step = N, status ready, consult_count 0, consult_response и consult_verdict пустые, last_result одной строкой, last_verify — команда и наблюдаемый исход, next_step = N+1). После шага 12: status queue_complete, next_step none. Закоммить только файлы шага и STATE явным списком. Сообщение `pdd platform step <N>: <заголовок>`. Без --trailer, без push.
10. Gate не прошёл: next_step и consult_count не меняй, status blocked, в last_result причина, в last_verify упавшая команда и первые строки вывода. Код не коммить. Sonnet в этом ходе не вызывай.
11. Один шаг за ход. После коммита, консультации или blocked остановись. В ответе: номер шага, команда gate или путь consult_response, исход.
```
