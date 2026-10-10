const messages: Record<string, string> = {
  'Replacement spreadsheet': 'Таблица для замены',
  'Replace spreadsheet': 'Заменить таблицу',
  'Replaces saved rows used by your APIs. Keep published columns and their types compatible.':
    'Заменяет сохранённые строки, которые используют ваши API. Сохраняйте совместимость опубликованных столбцов и их типов.',
  'Replace saved data for {source}? APIs using this source will read the new snapshot.':
    'Заменить сохранённые данные источника {source}? API, использующие этот источник, будут читать новый снимок данных.',
  'Spreadsheet replaced. Your APIs now use the saved data.':
    'Таблица заменена. Ваши API теперь используют сохранённые данные.',
  'FROM SPREADSHEET TO API': 'ИЗ ТАБЛИЦЫ В API',
  'Bring your data. Preview its columns. Build an API without writing JSON.':
    'Добавьте данные, просмотрите столбцы и создайте API без написания JSON.',
  'Refresh list': 'Обновить список',
  'Import a spreadsheet': 'Импортировать таблицу',
  'Check your data': 'Проверить данные',
  'Choose API fields': 'Выбрать поля API',
  'Add a data source': 'Добавить источник данных',
  'Import method': 'Способ импорта',
  'Spreadsheet file': 'Файл таблицы',
  'Public Google Sheet': 'Общедоступная Google Таблица',
  'Source name': 'Название источника',
  Products: 'Товары',
  'Import spreadsheet': 'Импортировать таблицу',
  'CSV or Excel (.xlsx), up to 2 MB. Put column names in the first row. Imports save a snapshot of your data.':
    'CSV или Excel (.xlsx), до 2 МБ. Укажите названия столбцов в первой строке. Импорт сохраняет снимок данных.',
  'No data sources yet.': 'Источников данных пока нет.',
  'Import a spreadsheet to see your data here.':
    'Импортируйте таблицу, чтобы увидеть данные здесь.',
  'Spreadsheet imported. Check your data before creating an API.':
    'Таблица импортирована. Проверьте данные перед созданием API.',
  'Saved data source': 'Сохранённый источник данных',
  '{source} · {count} rows': '{source} · строк: {count}',
  '{count} rows': 'Строк: {count}',
  'Empty cells allowed': 'Пустые ячейки разрешены',
  Empty: 'Пусто',
  'Use an exact path, such as /v1/messages. WebSocket messages carry input values; named path parameters are not supported.':
    'Используйте точный путь, например /v1/messages. Сообщения WebSocket передают входные значения; именованные параметры пути не поддерживаются.',
  'Use an exact path, such as /v1/customers. GraphQL arguments carry input values.':
    'Используйте точный путь, например /v1/customers. Аргументы GraphQL передают входные значения.',
  'GRAPHQL OPERATION': 'ОПЕРАЦИЯ GRAPHQL',
  'Live · v{version}': 'Опубликовано · v{version}',
  'Saved · revision {revision}': 'Сохранено · ревизия {revision}',
  '{nodes} nodes · {connections} connections':
    'Узлы: {nodes} · Соединения: {connections}',
  'Use /v1/customers/:id for a versioned route with a path parameter. Each :name occupies a whole route segment.':
    'Используйте /v1/customers/:id для маршрута с версией и параметром пути. Каждый :name должен занимать целый сегмент маршрута.',
  'Owner and member keys manage drafts. Create an API key in API keys to call a published endpoint.':
    'Ключи владельца и участников управляют черновиками. Создайте ключ API в разделе «Ключи API», чтобы вызывать опубликованный эндпоинт.',
  'REQUEST DETAILS': 'ДАННЫЕ ЗАПРОСА',
  '// Save your draft, then run a test.\n// Your response will appear here.':
    '// Сохраните черновик, затем запустите тест.\n// Здесь появится ваш ответ.',
  'Discard unsaved draft changes?':
    'Отменить несохранённые изменения черновика?',
  'Start with your spreadsheet, or build a blank API using the request and response below. Opening either path does not save or publish an API. You choose when to create or save its draft.':
    'Начните со своей таблицы или создайте пустой API с запросом и ответом ниже. Открытие любого варианта не сохраняет и не публикует API. Вы сами выбираете, когда создать или сохранить черновик.',
  'Your next idea starts here.': 'Ваша следующая идея начинается здесь.',
  'Create your first API.': 'Создайте первый API.',
  'Your team': 'Ваша команда',
  'WORKSPACE CONTROL': 'УПРАВЛЕНИЕ РАБОЧИМ ПРОСТРАНСТВОМ',
  'Member keys manage the workspace. Use API keys for published endpoint callers.':
    'Ключи участников управляют рабочим пространством. Для вызова опубликованных эндпоинтов используйте ключи API.',
  'Loading workspace records…': 'Загрузка записей рабочего пространства…',
  'Only the owner can manage members and roles.':
    'Только владелец может управлять участниками и ролями.',
  'Refresh Members and review an active tenant before creating this member.':
    'Обновите страницу участников и проверьте активного арендатора перед созданием этого участника.',
  'Create {name} with assigned tenant {tenant}? Protected API actions derive this identity. API permissions and dependency USE remain separate. This assignment and member credential are created together.':
    'Создать участника {name} с назначенным арендатором {tenant}? Защищённые действия API используют эту идентичность. Разрешения API и разрешения USE для зависимостей остаются независимыми. Назначение и учётные данные участника создаются вместе.',
  'Member created. Save their token; it is shown once.':
    'Участник создан. Сохраните его токен: он показывается только один раз.',
  Name: 'Имя',
  'Member name': 'Имя участника',
  Role: 'Роль',
  'Member role': 'Роль участника',
  'Member email (optional)': 'Электронная почта участника (необязательно)',
  'Member password': 'Пароль участника',
  '12 to 128 characters. Leave email blank for key-only access.':
    'От 12 до 128 символов. Оставьте электронную почту пустой для доступа только по ключу.',
  'New member API access': 'Доступ нового участника к API',
  'New member tenant': 'Арендатор нового участника',
  'No tenant assigned': 'Арендатор не назначен',
  'Optional initial assignment. Review before adding the member; no separate credential creation and reassignment occurs.':
    'Необязательное первоначальное назначение. Проверьте его до добавления участника; отдельного создания учётных данных с последующим переназначением не происходит.',
  'Add member': 'Добавить участника',
  'Save this member token': 'Сохраните этот токен участника',
  'New member token': 'Новый токен участника',
  'Member token copied.': 'Токен участника скопирован.',
  Copy: 'Копировать',
  'I saved it': 'Я сохранил',
  'Opening invitations…': 'Открытие приглашений…',
  'API access': 'Доступ к API',
  'Tenant identity': 'Идентичность арендатора',
  'Invite sign-in': 'Пригласить настроить вход',
  'Bootstrap owner': 'Первоначальный владелец',
  'Revoke access for {name}?': 'Отозвать доступ участника {name}?',
  'Member access revoked.': 'Доступ участника отозван.',
  'Selected APIs · {count}': 'Выбранные API · {count}',
  'Manage APIs for {name}': 'Управлять API участника {name}',
  'Owner access cannot be restricted.': 'Доступ владельца нельзя ограничить.',
  'Owner reviews a tenant for each protected action.':
    'Владелец проверяет арендатора для каждого защищённого действия.',
  'Assigned tenant': 'Назначенный арендатор',
  'Manage tenant for {name}': 'Управлять арендатором участника {name}',
  'Viewer · read APIs': 'Наблюдатель · чтение API',
  'Editor · build and test': 'Редактор · создание и тестирование',
  '{name} · custom role': '{name} · пользовательская роль',
  'Role for {name}': 'Роль участника {name}',
  "Change {name}'s role from {current} to {next}? This ends their active browser sessions. Their member key immediately uses the new permissions.":
    'Изменить роль участника {name} с {current} на {next}? Это завершит его активные сеансы браузера. Его ключ участника немедленно начнёт использовать новые разрешения.',
  'Member role updated. Their browser sessions were ended.':
    'Роль участника обновлена. Его сеансы браузера завершены.',
  'Could not update member role.': 'Не удалось обновить роль участника.',
  'Change role': 'Изменить роль',
  'Selected APIs only': 'Только выбранные API',
  'Selected sharing limits API scope. Use Viewer or a custom role with only API, runtime-key and load-test actions. Actions still require separate role grants. It grants no API creation or global resource management.':
    'Выборочный общий доступ ограничивает область API. Используйте роль наблюдателя или пользовательскую роль только с действиями API, ключей для вызовов и нагрузочных тестов. Для действий по-прежнему нужны отдельные разрешения роли. Это не даёт права создавать API или управлять глобальными ресурсами.',
  'This role has actions beyond Read APIs and selected API operations. Choose an eligible custom role or Viewer, or explicitly select All APIs before continuing.':
    'Эта роль содержит действия помимо чтения API и операций с выбранными API. Выберите подходящую пользовательскую роль или роль наблюдателя либо явно выберите все API перед продолжением.',
  'Choose APIs to share': 'Выберите API для общего доступа',
  'Share {name}': 'Поделиться {name}',
  '{count} APIs selected.': 'Выбрано API: {count}.',
  'No APIs selected. This member can sign in, but sees no APIs.':
    'API не выбраны. Этот участник может войти, но не видит API.',
  'Dependencies these APIs may use':
    'Зависимости, которые могут использовать эти API',
  'USE permits these selected APIs to read chosen dependency data or trigger product login when the role allows testing, publishing or callers. It can expose stored data through the API. It grants no dependency preview or management. Row, column and tenant authorization remain separate; selecting APIs or dependencies does not provide them.':
    'Разрешение USE позволяет выбранным API читать данные выбранных зависимостей или запускать вход в продукт, когда роль разрешает тестирование, публикацию или вызовы API. Оно может раскрывать сохранённые данные через API, но не даёт доступа к просмотру или управлению зависимостями. Авторизация строк, столбцов и арендаторов остаётся отдельной; выбор API или зависимостей её не предоставляет.',
  'Use spreadsheet sources': 'Использовать источники таблиц',
  'Use SQLite copies': 'Использовать копии SQLite',
  'Use product login connections': 'Использовать подключения входа в продукт',
  'Use spreadsheet {name}': 'Использовать таблицу {name}',
  'Use SQLite copy {name}': 'Использовать копию SQLite {name}',
  'Use product login {name}': 'Использовать вход в продукт {name}',
  'Structure only · version {version}': 'Только структура · версия {version}',
  'No saved dependencies in this group.':
    'В этой группе нет сохранённых зависимостей.',
  '{count} dependencies allowed for USE.':
    'Зависимостей с разрешением USE: {count}.',
  'All current and future APIs. Actions still follow the assigned role.':
    'Все существующие и будущие API. Действия по-прежнему определяются назначенной ролью.',
  'Custom roles': 'Пользовательские роли',
  'New role': 'Новая роль',
  'Choose actions for this local workspace. Every member can manage their own account and sessions. Member and role administration stays with the owner.':
    'Выберите действия для этого локального рабочего пространства. Каждый участник может управлять своим аккаунтом и сеансами. Управление участниками и ролями остаётся у владельца.',
  'Actions are separate: editing, testing, and publication each need their own grant. Reading related APIs or connections is needed to choose them in forms.':
    'Действия независимы: для редактирования, тестирования и публикации нужны отдельные разрешения. Для выбора связанных API или подключений в формах нужен доступ к их чтению.',
  'Loading permission choices…': 'Загрузка доступных разрешений…',
  'Retry permission choices': 'Загрузить разрешения повторно',
  'Save changes to {name}? Changed grants apply immediately to member keys and end affected browser sessions. Review all selected permissions before continuing.':
    'Сохранить изменения роли {name}? Изменённые разрешения немедленно применяются к ключам участников и завершают затронутые сеансы браузера. Перед продолжением проверьте все выбранные разрешения.',
  'Role updated. Changed grants end affected browser sessions.':
    'Роль обновлена. Изменённые разрешения завершают затронутые сеансы браузера.',
  'Role created. Assign it to a member when ready.':
    'Роль создана. Назначьте её участнику, когда будете готовы.',
  'Could not save role.': 'Не удалось сохранить роль.',
  'Edit {name} · version {version}': 'Изменить {name} · версия {version}',
  'Create custom role': 'Создать пользовательскую роль',
  'Role name': 'Название роли',
  'No workspace action grants. Members with this role can still sign in and manage their own account.':
    'Разрешения на действия в рабочем пространстве не выданы. Участники с этой ролью по-прежнему могут входить и управлять своим аккаунтом.',
  'Backup access exposes the entire workspace, including saved data and sensitive credential records. Keep downloads private.':
    'Доступ к резервным копиям раскрывает всё рабочее пространство, включая сохранённые данные и конфиденциальные записи учётных данных. Не передавайте скачанные файлы посторонним.',
  'Load testing repeatedly executes live APIs. Configured writes can change product data. Grant only to trusted operators.':
    'Нагрузочное тестирование многократно выполняет действующие API. Настроенные операции записи могут менять данные продукта. Выдавайте разрешение только доверенным операторам.',
  'Save role': 'Сохранить роль',
  'Cancel role changes': 'Отменить изменения роли',
  'If another owner session changes this role, refresh the members page and reopen the role before saving again.':
    'Если другой сеанс владельца изменит эту роль, обновите страницу участников и заново откройте роль перед повторным сохранением.',
  'Custom · v{version}': 'Пользовательская · v{version}',
  'Account and own sessions only': 'Только свой аккаунт и сеансы',
  'Edit {name}': 'Изменить {name}',
  'Delete role {name}? This cannot be undone. Roles assigned to members cannot be deleted.':
    'Удалить роль {name}? Это действие нельзя отменить. Роли, назначенные участникам, удалить нельзя.',
  'Role deleted.': 'Роль удалена.',
  'Could not delete role.': 'Не удалось удалить роль.',
  'Delete {name}': 'Удалить {name}',
  'No custom roles yet. Built-in owner, editor, and viewer roles stay available.':
    'Пользовательских ролей пока нет. Встроенные роли владельца, редактора и наблюдателя остаются доступны.',
  'Read APIs': 'Читать API',
  'Edit APIs': 'Редактировать API',
  'Test drafts': 'Тестировать черновики',
  'Publish and roll back': 'Публиковать и откатывать',
  'Read data sources': 'Читать источники данных',
  'Manage data sources': 'Управлять источниками данных',
  'Read database copies': 'Читать копии баз данных',
  'Manage database copies': 'Управлять копиями баз данных',
  'Read product login connections': 'Читать подключения входа в продукт',
  'Manage product login connections': 'Управлять подключениями входа в продукт',
  'Manage runtime API keys': 'Управлять ключами API для вызовов',
  'Read audit history': 'Читать историю аудита',
  'Manage workspace backups':
    'Управлять резервными копиями рабочего пространства',
  'Read migration history': 'Читать историю миграций',
  'Run load tests': 'Запускать нагрузочные тесты',
  APIs: 'API',
  Databases: 'Базы данных',
  Security: 'Безопасность',
  'Read authorized API drafts, release history, OpenAPI documents, client examples, and generated backend source.':
    'Читать разрешённые черновики API, историю выпусков, документы OpenAPI, примеры клиентов и сгенерированный исходный код серверной части.',
  'Create and save API drafts. Selected access permits editing existing shared APIs with explicit dependency use, but cannot create APIs.':
    'Создавать и сохранять черновики API. Выборочный доступ позволяет редактировать существующие общие API при явном разрешении на использование зависимостей, но не позволяет создавать API.',
  'Execute saved REST and GraphQL drafts, including their configured data and product-login steps. Selected access also requires explicit dependency use.':
    'Выполнять сохранённые черновики REST и GraphQL, включая настроенные шаги чтения данных и входа в продукт. Выборочный доступ также требует явного разрешения на использование зависимостей.',
  'Change live API behavior by publishing drafts or rolling back releases.':
    'Менять поведение действующих API, публикуя черновики или откатывая выпуски.',
  'Read source metadata and saved rows.':
    'Читать метаданные источников и сохранённые строки.',
  'Import, replace, refresh, and delete sources. Replacing data changes what published APIs read.':
    'Импортировать, заменять, обновлять и удалять источники. Замена данных меняет содержимое, которое читают опубликованные API.',
  'Read uploaded SQLite copy metadata and selected rows. Generated APIs may expose their configured data.':
    'Читать метаданные загруженных копий SQLite и выбранные строки. Сгенерированные API могут раскрывать настроенные в них данные.',
  'Upload, check, and delete immutable SQLite copies. Workspace backups include all uploaded data.':
    'Загружать, проверять и удалять неизменяемые копии SQLite. Резервные копии рабочего пространства включают все загруженные данные.',
  'Read product-login connection metadata without provider secrets.':
    'Читать метаданные подключений входа в продукт без секретов провайдера.',
  'Create, update, and delete server-held provider credentials. Changes affect live product login.':
    'Создавать, обновлять и удалять учётные данные провайдера, хранящиеся на сервере. Изменения влияют на действующий вход в продукт.',
  'Issue, list, replace, and revoke runtime keys. Selected access manages issuer-bound keys for shared APIs; issuance and replacement require dependency use and preserve release pins.':
    'Выдавать, перечислять, заменять и отзывать ключи для вызовов API. Выборочный доступ позволяет управлять ключами общих API, привязанными к выдавшему их участнику; выдача и замена требуют разрешения на использование зависимостей и сохраняют привязки к выпускам.',
  'Read workspace activity and security events.':
    'Читать события активности и безопасности рабочего пространства.',
  'Create, list, and download complete workspace backups containing saved data and sensitive credential records.':
    'Создавать, перечислять и скачивать полные резервные копии рабочего пространства, содержащие сохранённые данные и конфиденциальные записи учётных данных.',
  'Read the control database migration history.':
    'Читать историю миграций управляющей базы данных.',
  'List published targets and load-test history; start and cancel bounded local runs. Runs execute published APIs and may cause their configured writes.':
    'Просматривать опубликованные цели и историю нагрузочных тестов; запускать и отменять ограниченные локальные запуски. Запуски выполняют опубликованные API и могут вызывать настроенные в них операции записи.',
  'Update available': 'Доступно обновление',
  'No newer release found': 'Более новый выпуск не найден',
  'No matching releases found': 'Подходящие выпуски не найдены',
  'Release check failed': 'Не удалось проверить выпуски',
  'Owner access required to manage Besh updates.':
    'Для управления обновлениями Besh нужны права владельца.',
  'Could not load update information.':
    'Не удалось загрузить сведения об обновлениях.',
  'YOUR BESH INSTALLATION': 'ВАША УСТАНОВКА BESH',
  'Besh updates': 'Обновления Besh',
  'Check public GitHub releases when you are ready.':
    'Проверьте общедоступные выпуски GitHub, когда будете готовы.',
  'Discard unsaved update settings and refresh?':
    'Отменить несохранённые настройки обновлений и загрузить заново?',
  'Refresh update settings': 'Обновить настройки обновлений',
  'Loading update settings…': 'Загрузка настроек обновлений…',
  'Update settings saved. Check releases to get a fresh result.':
    'Настройки обновлений сохранены. Проверьте выпуски, чтобы получить новый результат.',
  'Release settings': 'Настройки выпусков',
  'GitHub repository': 'Репозиторий GitHub',
  'Use a public repository URL. Private repositories and access tokens are not supported.':
    'Укажите URL общедоступного репозитория. Приватные репозитории и токены доступа не поддерживаются.',
  'Include preview releases': 'Включать предварительные выпуски',
  'Show alpha, beta and other prereleases alongside stable versions.':
    'Показывать alpha, beta и другие предварительные выпуски вместе со стабильными версиями.',
  'Save update settings': 'Сохранить настройки обновлений',
  'Save your changes before checking releases.':
    'Сохраните изменения перед проверкой выпусков.',
  'Release status': 'Статус выпуска',
  'Installed {version}': 'Установлена версия {version}',
  'No release check yet': 'Выпуски ещё не проверялись',
  'Last checked {date}': 'Последняя проверка: {date}',
  'Preview release': 'Предварительный выпуск',
  'View GitHub release': 'Посмотреть выпуск на GitHub',
  'A check runs only when you choose it. Opening this page uses saved information.':
    'Проверка запускается только по вашему выбору. При открытии страницы используются сохранённые сведения.',
  'Release check finished. Review the result below.':
    'Проверка выпусков завершена. Посмотрите результат ниже.',
  'Check releases': 'Проверить выпуски',
  'One check per minute. Checks inspect the first 20 published GitHub releases.':
    'Одна проверка в минуту. Проверяются первые 20 опубликованных выпусков GitHub.',
  'This page reports versions. It does not install updates or verify release compatibility. Review release notes and back up data before upgrading.':
    'Эта страница сообщает о версиях. Она не устанавливает обновления и не проверяет совместимость выпусков. Перед обновлением прочитайте примечания к выпуску и создайте резервную копию данных.',
  'Only the owner can manage Besh release settings and update notices.':
    'Только владелец может управлять настройками выпусков Besh и уведомлениями об обновлениях.',
  'YOUR WORKSPACE ACCESS': 'ВАШ ДОСТУП К РАБОЧЕМУ ПРОСТРАНСТВУ',
  'Manage your email sign-in and active browser sessions.':
    'Управляйте входом по электронной почте и активными сеансами браузера.',
  'Loading your account…': 'Загрузка вашего аккаунта…',
  'Sign-in details saved. Other browser sessions were revoked.':
    'Данные входа сохранены. Другие сеансы браузера отозваны.',
  'Could not save sign-in details.': 'Не удалось сохранить данные входа.',
  'Optional. Your workspace key still works. Saving new details signs out your other browser sessions.':
    'Необязательно. Ваш ключ рабочего пространства по-прежнему работает. Сохранение новых данных завершит ваши другие сеансы браузера.',
  'Account email': 'Электронная почта аккаунта',
  'Use 12 to 128 characters.': 'Используйте от 12 до 128 символов.',
  'Confirm your identity': 'Подтвердите свою личность',
  'Current password': 'Текущий пароль',
  'Your workspace key': 'Ваш ключ рабочего пространства',
  'Save sign-in details': 'Сохранить данные входа',
  'Active sessions': 'Активные сеансы',
  'Owners can revoke sessions across this workspace.':
    'Владельцы могут отзывать сеансы во всём рабочем пространстве.',
  'Only your own active sessions appear here.':
    'Здесь показаны только ваши активные сеансы.',
  'Session expires {date}.': 'Сеанс истекает {date}.',
  'Refresh sessions': 'Обновить сеансы',
  Member: 'Участник',
  Device: 'Устройство',
  'Last active': 'Последняя активность',
  Expires: 'Истекает',
  Access: 'Доступ',
  'This device': 'Это устройство',
  'Other browser session': 'Другой сеанс браузера',
  'Revoke session for {name} on this device':
    'Отозвать сеанс участника {name} на этом устройстве',
  'Revoke session for {name}': 'Отозвать сеанс участника {name}',
  'Revoke this session and sign out?': 'Отозвать этот сеанс и выйти?',
  'Revoke this browser session for {name}?':
    'Отозвать этот сеанс браузера участника {name}?',
  'This session was revoked. Sign in again.':
    'Этот сеанс отозван. Войдите снова.',
  'Browser session revoked.': 'Сеанс браузера отозван.',
  Revoke: 'Отозвать',
  'No active sessions.': 'Нет активных сеансов.',
  Language: 'Язык',
  'Use device language': 'Использовать язык устройства',
  Appearance: 'Оформление',
  Light: 'Светлая',
  Dark: 'Тёмная',
  System: 'Системная',
  'API Studio': 'Студия API',
  'Data sources': 'Источники данных',
  'Database connections': 'Подключения к базам данных',
  'Product login': 'Вход в продукт',
  'Load testing': 'Нагрузочное тестирование',
  'Audit trail': 'Журнал аудита',
  Members: 'Участники',
  'Tenant protection': 'Защита данных арендаторов',
  'API keys': 'Ключи API',
  'Account & sessions': 'Аккаунт и сеансы',
  'Data & backups': 'Данные и резервные копии',
  Updates: 'Обновления',
  'What’s next': 'Что дальше',
  Workspace: 'Рабочее пространство',
  'Local workspace': 'Локальное рабочее пространство',
  WORKSPACE: 'РАБОЧЕЕ ПРОСТРАНСТВО',
  'YOUR APIS': 'ВАШИ API',
  'New API': 'Новый API',
  'Workspace navigation': 'Навигация рабочего пространства',
  'Sign out': 'Выйти',
  'Working…': 'Выполняется…',
  'Opening your workspace…': 'Открываем ваше рабочее пространство…',
  'Opening invitation…': 'Открываем приглашение…',
  'Opening studio…': 'Открываем студию…',
  'Try again': 'Повторить',
  'Help & roadmap': 'Помощь и планы',
  'Drafts stay separate from published APIs':
    'Черновики отделены от опубликованных API',
  'No APIs shared': 'Нет доступных API',
  'Permission required': 'Требуется разрешение',
  'Owner access required': 'Требуется доступ владельца',
  'Editor access required': 'Требуется доступ редактора',
  Save: 'Сохранить',
  Cancel: 'Отмена',
  Close: 'Закрыть',
  Refresh: 'Обновить',
  Search: 'Поиск',
  'API tools': 'Инструменты API',
  'Review details': 'Проверить сведения',
  'Besh home': 'Главная Besh',
  'A SPACE FOR YOUR NEXT IDEA': 'МЕСТО ДЛЯ ВАШЕЙ НОВОЙ ИДЕИ',
  'Your next API.': 'Ваш следующий API.',
  'Clearly connected.': 'Понятные связи.',
  'Turn an idea into an endpoint. Build visually, test your flow, and publish when you’re ready.':
    'Превратите идею в API. Соберите схему, проверьте её и опубликуйте, когда будете готовы.',
  'Start with a simple request.': 'Начните с простого запроса.',
  'Ask for exactly what you need.': 'Запрашивайте только нужное.',
  'JSON response': 'Ответ JSON',
  Request: 'Запрос',
  Response: 'Ответ',
  'Your workspace. Your APIs. Private by default.':
    'Ваше пространство. Ваши API. Приватность по умолчанию.',
  '02 / SAVE YOUR KEY': '02 / СОХРАНИТЕ КЛЮЧ',
  '01 / MAKE IT YOURS': '01 / НАСТРОЙТЕ ПОД СЕБЯ',
  'WELCOME BACK': 'С ВОЗВРАЩЕНИЕМ',
  'Your workspace is ready.': 'Ваше рабочее пространство готово.',
  'A little setup. A lot of possibility.':
    'Немного настроек. Много возможностей.',
  'Open your workspace.': 'Откройте своё рабочее пространство.',
  'Keep this owner key safe. It is shown once.':
    'Сохраните ключ владельца. Он показывается только один раз.',
  'Choose a name for your workspace. We’ll create an owner key so you can get started.':
    'Назовите рабочее пространство. Мы создадим ключ владельца для начала работы.',
  'Sign in with email and password, or your owner or member key. Configure email sign-in in Account & sessions.':
    'Войдите с почтой и паролем или ключом владельца либо участника. Вход по почте настраивается в разделе «Аккаунт и сеансы».',
  'Sign-in method': 'Способ входа',
  'Workspace key': 'Ключ рабочего пространства',
  'Email & password': 'Почта и пароль',
  'Workspace name': 'Название рабочего пространства',
  'Setup key': 'Ключ настройки',
  'Open the setup link printed in your server terminal.':
    'Откройте ссылку настройки из терминала сервера.',
  'Visual API Studio': 'Визуальная студия API',
  'Separate drafts and releases': 'Черновики отдельно от релизов',
  'Private workspace': 'Приватное рабочее пространство',
  Email: 'Почта',
  Password: 'Пароль',
  'Your owner key': 'Ваш ключ владельца',
  'Workspace token': 'Токен рабочего пространства',
  'Copy owner key': 'Скопировать ключ владельца',
  'I saved my owner key': 'Я сохранил ключ владельца',
  'Your key creates a private browser session. The key is discarded after sign-in.':
    'Ключ создаёт приватный сеанс в браузере. После входа ключ удаляется из браузера.',
  'Enter studio': 'Открыть студию',
  'Create workspace': 'Создать рабочее пространство',
  'Open workspace': 'Открыть рабочее пространство',
  'A small start. Something worth building.':
    'Маленькое начало. Достойная идея.',
  'Workspace created. Save your owner key.':
    'Рабочее пространство создано. Сохраните ключ владельца.',
  'Owner key copied.': 'Ключ владельца скопирован.',
  'YOUR WORKSPACE INVITATION': 'ВАШЕ ПРИГЛАШЕНИЕ',
  'Your workspace invite.': 'Приглашение в рабочее пространство.',
  'Set up email sign-in for your existing member. Your role and API access do not change.':
    'Настройте вход по почте для существующего участника. Роль и доступ к API не изменятся.',
  'Accept invitation': 'Принять приглашение',
  'Password set': 'Пароль установлен',
  'Email sign-in is ready for {email}. You are not signed in yet.':
    'Вход по почте готов для {email}. Вы ещё не вошли.',
  'Sign in': 'Войти',
  'Reading invitation…': 'Читаем приглашение…',
  'Check invitation': 'Проверить приглашение',
  'Selected APIs': 'Выбранные API',
  'All APIs': 'Все API',
  'Expires {date}.': 'Истекает {date}.',
  'Current sign-in': 'Текущий вход',
  'Checking current sign-in…': 'Проверяем текущий вход…',
  'You are signed in as {name}. Sign out explicitly before setting this member’s password.':
    'Вы вошли как {name}. Выйдите перед установкой пароля этого участника.',
  'Sign out to accept invitation': 'Выйти для принятия приглашения',
  'Return to workspace': 'Вернуться в рабочее пространство',
  'No workspace sign-in is active.': 'В рабочее пространство никто не вошёл.',
  'Check current sign-in': 'Проверить текущий вход',
  'New password': 'Новый пароль',
  'Invitation password': 'Новый пароль',
  'Confirm password': 'Подтвердите пароль',
  'Confirm invitation password': 'Подтвердите пароль',
  'Use 12 to 128 characters. Your existing workspace key still works.':
    'Используйте от 12 до 128 символов. Ваш прежний ключ продолжит работать.',
  'Set password': 'Установить пароль',
  'Leave invitation and sign in': 'Закрыть приглашение и войти',
  'Discard unsaved draft changes and sign out to accept this invitation?':
    'Отменить несохранённые изменения и выйти, чтобы принять приглашение?',
  'Passwords must match.': 'Пароли должны совпадать.',
  'Could not read invitation.': 'Не удалось прочитать приглашение.',
  'Could not read your current sign-in.': 'Не удалось проверить текущий вход.',
  'Current sign-in unknown. Check it before setting a password.':
    'Состояние входа неизвестно. Проверьте его перед установкой пароля.',
  'Could not confirm sign-out. Check current sign-in before continuing; no automatic retry was made.':
    'Не удалось подтвердить выход. Проверьте состояние входа; автоматического повтора не было.',
  'Could not confirm password setup.':
    'Не удалось подтвердить установку пароля.',
  'No automatic retry was made. Try ordinary email sign-in if it may have succeeded, or ask the owner to refresh invitations and review a new link.':
    'Автоматического повтора не было. Если пароль мог сохраниться, попробуйте обычный вход по почте или попросите владельца проверить приглашения и новую ссылку.',
  'Sign-in invitation': 'Приглашение для входа',
  Invitations: 'Приглашения',
  'Set up email sign-in for an existing key-only member. Their role, API access and tenant assignment stay unchanged. Existing accounts cannot be reset with an invitation.':
    'Настройте вход по почте для участника, использующего только ключ. Роль, доступ к API и назначенный арендатор не изменятся. Приглашение не сбрасывает существующий аккаунт.',
  'Refresh invitations': 'Обновить приглашения',
  'Loading invitations…': 'Загружаем приглашения…',
  'Current invitations unknown. Refresh needed.':
    'Текущее состояние приглашений неизвестно. Обновите список.',
  'Existing member': 'Существующий участник',
  'Invitation member': 'Существующий участник',
  'Invitation email': 'Почта приглашения',
  'Expires in 24 hours. Besh does not send email.':
    'Истекает через 24 часа. Besh не отправляет письма.',
  'Anyone holding the link can set this member’s password. It does not prove email ownership. Share it privately. Creating another link invalidates this member’s earlier invitation; their workspace key still works.':
    'Любой обладатель ссылки может установить пароль участника. Это не подтверждает владение почтой. Передавайте ссылку приватно. Новая ссылка отменяет предыдущее приглашение; ключ участника продолжает работать.',
  'Create invitation link': 'Создать ссылку приглашения',
  'Save this invitation link': 'Сохраните эту ссылку',
  'Link status unconfirmed. Refresh invitations before sharing it.':
    'Статус ссылки не подтверждён. Обновите приглашения перед передачей.',
  'Current pending invitation.': 'Текущее ожидающее приглашение.',
  'This invitation is no longer active. Its link cannot set a password.':
    'Приглашение больше не действует. Ссылка не позволит установить пароль.',
  'Invitation link': 'Ссылка приглашения',
  'Copy invitation link': 'Скопировать ссылку',
  'I saved the link': 'Я сохранил ссылку',
  'Pending invitations': 'Ожидающие приглашения',
  'Refresh to read current pending invitations.':
    'Обновите список ожидающих приглашений.',
  'Revoke invitation': 'Отозвать приглашение',
  'No pending invitations.': 'Нет ожидающих приглашений.',
  'Close invitations': 'Закрыть приглашения',
  'Could not read invitations.': 'Не удалось прочитать приглашения.',
  'Refresh invitations before changing a link.':
    'Обновите приглашения перед изменением ссылки.',
  'Refresh invitations before trying again.':
    'Обновите приглашения перед повтором.',
  'Could not confirm whether the invitation was created. Refresh invitations to review current links before reissuing or revoking.':
    'Не удалось подтвердить создание приглашения. Обновите список перед повторной выдачей или отзывом.',
  'Could not confirm whether the invitation was revoked. Refresh invitations before changing another link.':
    'Не удалось подтвердить отзыв приглашения. Обновите список перед изменением другой ссылки.',
  'Invitation created. Copy the link; it is shown once.':
    'Приглашение создано. Скопируйте ссылку; она показывается один раз.',
  'Invitation revoked. That link can no longer set a password.':
    'Приглашение отозвано. Ссылка больше не позволяет установить пароль.',
  'Invitation link copied.': 'Ссылка приглашения скопирована.',
  'Invitation unavailable': 'Приглашение недоступно',
  'Too many invitation attempts':
    'Слишком много попыток использования приглашения',
  'Email address unavailable': 'Адрес почты недоступен',
  'Invitation state unavailable': 'Состояние приглашений недоступно',
  'Choose a member and valid email address':
    'Выберите участника и укажите корректную почту',
  'Choose an existing member without an account':
    'Выберите существующего участника без аккаунта',
  'Pending invitation limit reached': 'Достигнут лимит ожидающих приглашений',
  'Provide an invitation token': 'Укажите токен приглашения',
  'Provide an invitation token and password of 12 to 128 characters':
    'Укажите токен приглашения и пароль от 12 до 128 символов',
  'Invalid credentials': 'Неверные данные для входа',
  'Too many login attempts': 'Слишком много попыток входа',
  'Enter a valid email address': 'Введите корректный адрес почты',
  'Password must contain 12 to 128 characters':
    'Пароль должен содержать от 12 до 128 символов',
  'Email and password must be provided together':
    'Укажите почту и пароль вместе',
  'Authentication required': 'Требуется вход',
  'Permission denied': 'Доступ запрещён',
  'Workspace is shutting down': 'Рабочее пространство закрывается',
  'Browser origin rejected': 'Источник браузера отклонён',
  'Session verification required': 'Требуется проверка сеанса',
  'Your session expired. Sign in again.': 'Сеанс истёк. Войдите снова.',
  'Your session expired or was revoked. Sign in again.':
    'Сеанс истёк или был отозван. Войдите снова.',
  'Signed out. This session was revoked.': 'Вы вышли. Сеанс отозван.',
  'This session has already ended. Sign in again.':
    'Сеанс уже завершён. Войдите снова.',
  'Workspace ready.': 'Рабочее пространство готово.',
  'Connect your first idea.': 'Соедините свою первую идею.',
  'Request failed': 'Запрос не выполнен',
  'Could not restore session.': 'Не удалось восстановить сеанс.',
  'Invitation link unavailable. Ask the owner for a new link.':
    'Ссылка приглашения недоступна. Попросите владельца выдать новую.',
  'nodePicker.open': 'Добавить шаг',
  'Add step': 'Добавить шаг',
  'nodePicker.title': 'Выберите шаг',
  'Choose a step': 'Выберите шаг',
  'nodePicker.search': 'Поиск шагов',
  'Search steps': 'Поиск шагов',
  'nodePicker.help':
    'Выберите шаг для черновика. Настройте его поля после добавления.',
  'Choose a step for this draft. Configure its fields after adding.':
    'Выберите шаг для черновика. Настройте его поля после добавления.',
  'nodePicker.all': 'Все шаги',
  'All steps': 'Все шаги',
  'nodePicker.favorites': 'Избранное',
  Favorites: 'Избранное',
  'nodePicker.empty': 'Шаги не найдены.',
  'No steps found.': 'Шаги не найдены.',
  'nodePicker.noFavorites': 'Пока нет избранных шагов.',
  'No favorite steps yet.': 'Пока нет избранных шагов.',
  'nodePicker.favorite': 'Добавить {name} в избранное',
  'Favorite {name}': 'Добавить {name} в избранное',
  'nodePicker.unfavorite': 'Удалить {name} из избранного',
  'Remove {name} from favorites': 'Удалить {name} из избранного',
  'nodePicker.add': 'Добавить {name}',
  'Add {name}': 'Добавить {name}',
  'nodePicker.close': 'Закрыть выбор шагов',
  'Close step picker': 'Закрыть выбор шагов',
  'nodePicker.unavailable': 'Недоступно для этого API',
  'Unavailable for this API': 'Недоступно для этого API',
  'nodePicker.requestExists': 'В этом API уже есть шаг запроса.',
  'This API already has a request step.': 'В этом API уже есть шаг запроса.',
  'nodePicker.category.api': 'API',
  API: 'API',
  'nodePicker.category.logic': 'Логика',
  Logic: 'Логика',
  'nodePicker.category.data': 'Данные',
  Data: 'Данные',
  'nodePicker.category.identity': 'Вход в продукт',
  'nodePicker.categories': 'Категории шагов',
  'Step categories': 'Категории шагов',
  'nodePicker.results': 'Подходящие шаги',
  'Matching steps': 'Подходящие шаги',
  'nodes.request.label': 'Запрос HTTP',
  'HTTP request': 'Запрос HTTP',
  'nodes.request.description': 'Запускает API и принимает входные данные.',
  'Start the API and receive its input.':
    'Запускает API и принимает входные данные.',
  'nodes.response.label': 'Ответ JSON',
  'nodes.response.description': 'Отправляет результат API вызывающей стороне.',
  'Send the API result back to its caller.':
    'Отправляет результат API вызывающей стороне.',
  'nodes.condition.label': 'Условие',
  Condition: 'Условие',
  'nodes.condition.description':
    'Сравнивает входное значение и выбирает следующий путь.',
  'Compare an input value and choose the next path.':
    'Сравнивает входное значение и выбирает следующий путь.',
  'nodes.data.label': 'Строки таблицы',
  'Spreadsheet rows': 'Строки таблицы',
  'nodes.data.description':
    'Читает выбранные поля из импортированной таблицы или сохранённого Google Sheet.',
  'Read chosen fields from an imported spreadsheet or saved Google Sheet.':
    'Читает выбранные поля из импортированной таблицы или сохранённого Google Sheet.',
  'nodes.database.label': 'Строки SQLite',
  'SQLite rows': 'Строки SQLite',
  'nodes.database.description':
    'Читает выбранные поля из загруженной копии SQLite.',
  'Read chosen fields from an uploaded SQLite copy.':
    'Читает выбранные поля из загруженной копии SQLite.',
  'nodes.social.label': 'Вход через GitHub',
  'GitHub login': 'Вход через GitHub',
  'nodes.social.description': 'Добавляет вход через GitHub в API продукта.',
  'Add GitHub sign-in to the product API.':
    'Добавляет вход через GitHub в API продукта.',
  'nodes.wsRequest.label': 'Получить сообщение',
  'Receive message': 'Получить сообщение',
  'nodes.wsRequest.description':
    'Принимает одно типизированное сообщение WebSocket.',
  'Receive one typed WebSocket message.':
    'Принимает одно типизированное сообщение WebSocket.',
  'nodes.wsResponse.label': 'Отправить ответ',
  'Send reply': 'Отправить ответ',
  'nodes.wsResponse.description':
    'Отправляет один типизированный ответ WebSocket.',
  'Send one typed WebSocket reply.':
    'Отправляет один типизированный ответ WebSocket.',
  'API editing is unavailable.': 'Редактирование API недоступно.',
  'This API already has 64 steps.': 'В этом API уже 64 шага.',
  'This API already has a starting step.': 'В этом API уже есть начальный шаг.',
  'This step is unavailable for WebSocket request/reply.':
    'Этот шаг недоступен для запросов и ответов WebSocket.',
  'This WebSocket API already has a reply step.':
    'В этом API WebSocket уже есть шаг ответа.',
  'WebSocket request/reply supports one data read.':
    'WebSocket поддерживает одно чтение данных для запроса и ответа.',
  Draft: 'Черновик',
  'Unsaved changes': 'Несохранённые изменения',
  Saved: 'Сохранено',
  'Save draft': 'Сохранить черновик',
  Publish: 'Опубликовать',
  'API name': 'Название API',
  'API NAME': 'НАЗВАНИЕ API',
  'API TYPE': 'ТИП API',
  'API type': 'Тип API',
  METHOD: 'МЕТОД',
  'HTTP method': 'Метод HTTP',
  'ENDPOINT PATH': 'ПУТЬ ЭНДПОИНТА',
  'Endpoint path': 'Путь эндпоинта',
  'Test flow': 'Проверить схему',
  'Request input': 'Входные данные запроса',
  'Apply configuration': 'Применить настройки',
  'Remove node': 'Удалить узел',
  'Advanced configuration': 'Расширенные настройки',
  'Node configuration': 'Настройки узла',
  'Create your first API': 'Создайте первый API',
  'Start with a spreadsheet': 'Начать с таблицы',
  'Build a blank API': 'Создать пустой API',
  'Response status': 'Статус ответа',
  'Response contents': 'Содержимое ответа',
  'Response fields': 'Поля ответа',
  'Rows from data step': 'Строки из шага данных',
  'GitHub login result': 'Результат входа через GitHub',
  'Input source': 'Источник ввода',
  'Input field': 'Входное поле',
  Comparison: 'Сравнение',
  Equals: 'Равно',
  'Expected type': 'Ожидаемый тип',
  'Expected value': 'Ожидаемое значение',
  Text: 'Текст',
  Number: 'Число',
  'True or false': 'Истина или ложь',
  'Empty value': 'Пустое значение',
  'Request body': 'Тело запроса',
  'Query parameter': 'Параметр запроса',
  'Path parameter': 'Параметр пути',
  'From request body': 'Из тела запроса',
  'From query parameter': 'Из параметра запроса',
  'From path parameter': 'Из параметра пути',
  'Nested data (preserved)': 'Вложенные данные (сохранены)',
  True: 'Истина',
  False: 'Ложь',
  'Path parameters': 'Параметры пути',
  'Query parameters': 'Параметры запроса',
  'Request body fields': 'Поля тела запроса',
  'Add query parameter': 'Добавить параметр запроса',
  'Add body field': 'Добавить поле тела запроса',
  'Add response field': 'Добавить поле ответа',
  '{prefix} name {number}': 'Имя {prefix} {number}',
  '{prefix} type {number}': 'Тип {prefix} {number}',
  '{prefix} value {number}': 'Значение {prefix} {number}',
  'Remove {prefix} field {number}': 'Удалить поле {prefix} {number}',
  'Path parameter {name}': 'Параметр пути {name}',
  'Value for :{name}': 'Значение для :{name}',
  Field: 'Поле',
  Body: 'Тело',
  Query: 'Запрос',
  'Finish opening your workspace or the current action, then reopen the invitation link. Your draft was kept.':
    'Дождитесь открытия пространства или завершения действия, затем снова откройте приглашение. Черновик сохранён.',
  'Leave the editor to review this invitation? Your unsaved draft will be kept until you return or confirm sign-out.':
    'Выйти из редактора для просмотра приглашения? Несохранённый черновик останется, пока вы не вернётесь или не подтвердите выход.',
  'Discard unsaved draft changes and open sign-in?':
    'Отменить несохранённые изменения и открыть вход?',
  'Workspace already configured': 'Рабочее пространство уже настроено',
  'Open the setup link from your server terminal':
    'Откройте ссылку настройки из терминала сервера',
  'HTTPS browser origin required':
    'Источник браузера должен использовать HTTPS',
  'Invitation revocation takes no fields':
    'Отзыв приглашения не принимает поля',
  'Request failed ({status}).': 'Запрос не выполнен ({status}).',
  'Invalid request': 'Некорректный запрос',
  'Invalid request body': 'Некорректное тело запроса',
  'REST API': 'REST API',
  'GraphQL API': 'GraphQL API',
  'Remove field {number}': 'Удалить поле {number}',
  'NODE SETTINGS': 'НАСТРОЙКИ УЗЛА',
  'BUILD SOMETHING USEFUL': 'СОЗДАЙТЕ ЧТО-ТО ПОЛЕЗНОЕ',
  'Connect the dots. Let your API do the work.':
    'Соедините шаги. Пусть API делает работу.',
  'API key protected': 'Защищено ключом API',
  'Published endpoint URL': 'URL опубликованного эндпоинта',
  'Flow canvas': 'Полотно схемы',
  'New draft': 'Новый черновик',
  'Try it out': 'Попробуйте',
  'WAITING FOR A RUN': 'ОЖИДАЕМ ЗАПУСКА',
  'Use this API': 'Использовать этот API',
  'Generated backend': 'Сгенерированный бэкенд',
  'Your API starts here': 'Ваш API начинается здесь',
  'Choose a path': 'Выберите путь',
  'Send something back': 'Отправьте ответ',
  'Read selected columns': 'Читать выбранные столбцы',
  'Read an uploaded copy': 'Читать загруженную копию',
  'Resolve a product identity': 'Определить пользователя продукта',
  'Data source': 'Источник данных',
  'Maximum rows': 'Максимум строк',
  'Filter rows': 'Фильтровать строки',
  'Match one column': 'Сопоставить один столбец',
  'Match column': 'Столбец для сравнения',
  'Match value type': 'Тип сравниваемого значения',
  'Fixed text': 'Фиксированный текст',
  'Fixed number': 'Фиксированное число',
  'Match value': 'Значение для сравнения',
  'Include {name}': 'Включить {name}',
  'API field: {name}': 'Поле API: {name}',
  'Small steps. Powerful APIs.': 'Маленькие шаги. Мощные API.',
  'Build a flow you can understand, test, and trust.':
    'Создайте схему, которую легко понять, проверить и которой можно доверять.',
  owner: 'владелец',
  editor: 'редактор',
  viewer: 'наблюдатель',
  'Unknown role': 'Роль неизвестна',
  'Custom role': 'Пользовательская роль',
  'Loading saved source details…':
    'Загрузка сведений о сохранённых источниках…',
  'No saved sources are available. Import a spreadsheet in Data sources, then return to this step.':
    'Сохранённых источников нет. Импортируйте таблицу в разделе «Источники данных», затем вернитесь к этому шагу.',
  'No allowed sources are available. Ask the owner to review source USE for your selected APIs.':
    'Разрешённых источников нет. Попросите владельца проверить разрешения USE для источников выбранных API.',
  'Choose a saved source to configure this step.':
    'Выберите сохранённый источник для настройки этого шага.',
  'Source details could not be loaded. Check the error above.':
    'Не удалось загрузить сведения об источниках. Проверьте ошибку выше.',
  'Source access is required. Ask the owner to review your permissions and source USE.':
    'Нужен доступ к источникам. Попросите владельца проверить ваши разрешения и разрешения USE для источников.',
  'No sources are available to this account. Ask the owner to provide a source.':
    'Для этой учётной записи нет доступных источников. Попросите владельца предоставить источник.',
}

export default messages
