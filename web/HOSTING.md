# GitHub Pages и DeepSeek

Основная ссылка редактора: https://gmanco77.github.io/figma-illustration-composer/

HTML, CSS, JavaScript и все SVG размещены на GitHub Pages. Исходники находятся в папке `web/`. Автоматическая публикация выполняется `.github/workflows/pages.yml`: проверяется и собирается `web/dist`, затем этот каталог публикуется как сайт.

## Как работает DeepSeek

GitHub Pages не запускает серверные функции и не хранит секреты во время работы посетителя. Поэтому браузер обращается к отдельному API по HTTPS. Уже подключённый сервер Vercel принимает только разрешённый GitHub origin `https://gmanco77.github.io` и собственные запросы. Он хранит ключ, вызывает DeepSeek и возвращает только проверенные ID предметов и объяснение. На GitHub нет ключа API; GitHub Actions тоже не получает его.

Публичная настройка `PUBLIC_API_BASE` содержит лишь адрес сервера. Сборка записывает его в `dist/src/site-config.mjs`. Для Vercel и локального запуска настройка по умолчанию пустая — используется API того же сайта. Это позволяет сменить сервер без переработки редактора.

## Бесплатные тарифы

- GitHub Pages доступен бесплатно для публичных репозиториев. Это статический хостинг, поэтому собственный закрытый API DeepSeek на одном Pages не запустить. Сервис не предназначен для коммерческого SaaS или электронной торговли: [описание](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [ограничения](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
- Vercel Hobby включает серверные функции и допускает личные некоммерческие проекты. Вызов внешнего API не требует платного Vercel Pro сам по себе; действуют лимиты тарифа. Тестовое демонстрационное приложение соответствует предполагаемому личному некоммерческому назначению; это вывод по условиям тарифа: [Hobby](https://vercel.com/docs/plans/hobby), [условия](https://vercel.com/legal/terms).
- DeepSeek API оплачивается отдельно за токены независимо от бесплатного хостинга: [тарифы](https://api-docs.deepseek.com/quick_start/pricing/).
- При необходимости полного отказа от Vercel сервер можно разместить на Cloudflare Workers Free. У него 100000 запросов в день и 10ms CPU на запрос; ожидание внешнего API не входит в CPU-время. Для ключа есть секреты. Это требует отдельного размещения и подключения учётной записи: [лимиты](https://developers.cloudflare.com/workers/platform/limits/), [секреты](https://developers.cloudflare.com/workers/configuration/secrets/).

Смена адреса сайта на github.io не превращает DeepSeek API в бесплатный. Бесплатными остаются размещение редактора и сервер в пределах их тарифов; запросы модели расходуют баланс DeepSeek. Локальный подбор по темам доступен без API.
