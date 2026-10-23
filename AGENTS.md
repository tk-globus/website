# Сайт турклубу «Глобус» — інструкція для ШІ-агента

Прототип нового сайту турклубу КПІ «Глобус» (старий сайт — https://www.tkg.org.ua).
Код пише ШІ, супервізор — Михайло (не розробник): пояснюй коротко й простою мовою.

## Контекст — у `../planning/`

Цей репозиторій лежить у робочому просторі поруч із `planning/` (памʼять проєкту, окремо від коду).
Перед роботою прочитай:

- `../AGENTS.md` — карта робочого простору;
- `../planning/CONTEXT.md` — поточний стан;
- `../planning/specs/0001-mvp-prototype.md` — специфікація;
- `../planning/decisions/` — ADR (рішення); не вигадуй рішень поза ними — питай супервізора;
- свій тікет у `../planning/tickets/`.

Терміни (МКК, к.с., н/к…) — з `../planning/glossary.md`.
Якщо `../planning/` немає (репо склоновано окремо) — попроси супервізора про робочий простір.

## Стек

Astro (статична генерація) + Tailwind CSS 4. Хостинг — Cloudflare Pages (проєкт `tk-globus`):
`main` → https://tk-globus.pages.dev, кожна гілка/PR → превʼю-адреса. Node — версія з `.nvmrc`.

## Команди

| Команда | Що робить |
|---|---|
| `npm install` | встановити залежності |
| `npm run dev` | локальний сервер розробки, http://localhost:4321 |
| `npm run build` | зібрати сайт у `dist/` (невалідні дані ламають збірку) |
| `npm run preview` | показати зібраний `dist/` |
| `npm run lint:tokens` | лінт «тільки токени» |
| `npm run check:links` | внутрішні посилання в `dist/` (після build) |
| `npm run test:scripts` | тести скриптів (`node --test`) |
| `npm run test:smoke` | смоук-тести Playwright проти зібраного сайту (після build) |
| `npm run check` | усе разом — те саме, що CI. Запускай перед PR |

Перший запуск смоук-тестів: `npx playwright install chromium`.

## Структура

```
src/
├── styles/theme.css     ← ТОКЕНИ: кольори, шрифт, відступи. Єдине місце для дизайн-значень
├── styles/global.css    ← підключає Tailwind і тему
├── data/settings.json   ← налаштування сайту: назва, опис, канали клубу, адреса, текст банера
├── lib/settings.ts      ← схема налаштувань (невалідний файл ламає збірку)
├── lib/nav.ts           ← пункти меню; href: null — сторінки ще немає
├── layouts/BaseLayout.astro ← макет кожної сторінки: noindex, банер прототипу, шапка, підвал
├── components/          ← компоненти (PrototypeBanner, SiteHeader, SiteFooter…)
├── assets/logo.svg      ← логотип «Глобуса» (не змінювати)
└── pages/               ← маршрути
public/                  ← robots.txt, _headers (noindex), favicon
scripts/                 ← lint-tokens.mjs, check-links.mjs
tests/smoke/             ← смоук-тести Playwright
tests/scripts/           ← тести скриптів
.github/workflows/ci.yml ← CI на кожен PR і push у main
```

## Правила

1. **Тільки токени** (ADR 0003). Кольори, шрифти, відступи — лише утиліти з токенів теми
   (`bg-brand`, `text-ink`, `p-4`, `max-w-page`). Заборонено поза `src/styles/`: hex/rgb-кольори,
   довільні значення Tailwind (`mt-[13px]`), стандартна палітра Tailwind (`bg-red-500`, `text-white`),
   `style="…"`, блоки `<style>`. Потрібне нове значення — додай токен у `theme.css`.
2. **Сторінки — лише з компонентів**, без власних стилів. Кожна сторінка обгортається `BaseLayout`.
3. **Дані — через схеми.** Налаштування — у `settings.json`; контент (тікети 05+) — content collections
   зі строгими схемами, сумісними з Keystatic. Тексти каналів, адреси тощо не зашивай у компоненти.
4. **Прототип:** на кожній сторінці `noindex` і банер; `robots.txt` забороняє індексацію. Не прибирати.
5. **Нові маршрути** додавай у список `routes` у `tests/smoke/layout.spec.ts`, а пункт меню вмикай
   у `src/lib/nav.ts` (замість `null` — адреса).
6. **Мова** інтерфейсу, коментарів і документації — українська.

## Процес

Тікет → гілка → PR → CI зелений + превʼю Cloudflare → перегляд Михайла → мердж (тільки після його «ок»).
Після тікета — онови `../planning/CONTEXT.md` і статус тікета. Нове рішення — новий ADR у `../planning/decisions/`.
