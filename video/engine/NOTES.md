# ПДД серия — заметки по точности (ep01–ep02), 20.10.2026
Источник норм: data/sources/law_ru_matsne_pub36_2026-06-25.txt (+ annexes_ru_matsne_pub36.*). Сверка с грузинским оригиналом НЕ проводилась.
Формат экзамена: data/sources/exam_format/sa_*.txt (скачано 20.10.2026): sa.gov.ge/p/driver-license/theoretical-test → B/B1: 30 вопросов, 25 верных;
news/details?id=703 → 5 ошибок вместо 3; p/gamocdiskitxvebi → всё ещё «27» для B (устарело). «30 минут» — только 1TV, 21.05.2026 (на sa.gov.ge не найдено).
Число изменяющих законов (36, 2014–2026) — подсчёт уникальных «Закон Грузии № … от …» в сносках рус. текста закона + приложений (ep01/boards.py, _amend).
Pipeline: python video/render.py <ep> [tts|video|all|still T…|sheet]; engine video/engine/core.py (+lib.py, cast.py); sign assets in content/assets/signs.
