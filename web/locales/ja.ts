const messages: Record<string, string> = {
  'Replacement spreadsheet': '置き換え用スプレッドシート',
  'Replace spreadsheet': 'スプレッドシートを置き換え',
  'Replaces saved rows used by your APIs. Keep published columns and their types compatible.':
    'API が使用する保存済みの行を置き換えます。公開済みの列とその型の互換性を保ってください。',
  'Replace saved data for {source}? APIs using this source will read the new snapshot.':
    '{source} の保存済みデータを置き換えますか？このデータソースを使用する API は新しいスナップショットを読み取ります。',
  'Spreadsheet replaced. Your APIs now use the saved data.':
    'スプレッドシートを置き換えました。API は保存済みデータを使用するようになりました。',
  'FROM SPREADSHEET TO API': 'スプレッドシートから API へ',
  'Bring your data. Preview its columns. Build an API without writing JSON.':
    'データを取り込み、列を確認して、JSON を書かずに API を作成できます。',
  'Refresh list': '一覧を更新',
  'Import a spreadsheet': 'スプレッドシートをインポート',
  'Check your data': 'データを確認',
  'Choose API fields': 'API フィールドを選択',
  'Add a data source': 'データソースを追加',
  'Import method': 'インポート方法',
  'Spreadsheet file': 'スプレッドシートファイル',
  'Public Google Sheet': '公開 Google スプレッドシート',
  'Source name': 'データソース名',
  Products: '商品',
  'Import spreadsheet': 'スプレッドシートをインポート',
  'CSV or Excel (.xlsx), up to 2 MB. Put column names in the first row. Imports save a snapshot of your data.':
    'CSV または Excel (.xlsx)、最大 2 MB。最初の行に列名を入力してください。インポートするとデータのスナップショットが保存されます。',
  'No data sources yet.': 'データソースはまだありません。',
  'Import a spreadsheet to see your data here.':
    'スプレッドシートをインポートすると、ここでデータを確認できます。',
  'Spreadsheet imported. Check your data before creating an API.':
    'スプレッドシートをインポートしました。API を作成する前にデータを確認してください。',
  'Saved data source': '保存済みデータソース',
  '{source} · {count} rows': '{source} · {count} 行',
  '{count} rows': '{count} 行',
  'Empty cells allowed': '空のセルを許可',
  Empty: '空',
  'Your team': 'チーム',
  'WORKSPACE CONTROL': 'ワークスペース管理',
  'Member keys manage the workspace. Use API keys for published endpoint callers.':
    'メンバーキーはワークスペースの管理に使います。公開済みエンドポイントを呼び出すには API キーを使ってください。',
  'Loading workspace records…': 'ワークスペースの記録を読み込み中…',
  'Only the owner can manage members and roles.':
    'メンバーとロールを管理できるのはオーナーのみです。',
  'Refresh Members and review an active tenant before creating this member.':
    'このメンバーを作成する前に、メンバーページを再読み込みして有効なテナントを確認してください。',
  'Create {name} with assigned tenant {tenant}? Protected API actions derive this identity. API permissions and dependency USE remain separate. This assignment and member credential are created together.':
    'テナント {tenant} を割り当てて {name} を作成しますか？保護された API 操作はこの割り当てから識別情報を取得します。API の権限と依存先の USE 権限は別です。この割り当てとメンバーの認証情報は同時に作成されます。',
  'Member created. Save their token; it is shown once.':
    'メンバーを作成しました。トークンは一度だけ表示されるため、保存してください。',
  Name: '名前',
  'Member name': 'メンバー名',
  Role: 'ロール',
  'Member role': 'メンバーのロール',
  'Member email (optional)': 'メンバーのメールアドレス（任意）',
  'Member password': 'メンバーのパスワード',
  '12 to 128 characters. Leave email blank for key-only access.':
    '12～128 文字。キーのみでアクセスする場合はメールアドレスを空欄にしてください。',
  'New member API access': '新しいメンバーの API アクセス',
  'New member tenant': '新しいメンバーのテナント',
  'No tenant assigned': 'テナント未割り当て',
  'Optional initial assignment. Review before adding the member; no separate credential creation and reassignment occurs.':
    '初期割り当ては任意です。メンバーを追加する前に確認してください。認証情報の作成と再割り当てを別々に行うことはありません。',
  'Add member': 'メンバーを追加',
  'Save this member token': 'このメンバートークンを保存',
  'New member token': '新しいメンバートークン',
  'Member token copied.': 'メンバートークンをコピーしました。',
  Copy: 'コピー',
  'I saved it': '保存しました',
  'Opening invitations…': '招待を開いています…',
  'API access': 'API アクセス',
  'Tenant identity': 'テナントの識別情報',
  'Invite sign-in': 'ログインに招待',
  'Bootstrap owner': '初期設定のオーナー',
  'Revoke access for {name}?': '{name} のアクセスを取り消しますか？',
  'Member access revoked.': 'メンバーのアクセスを取り消しました。',
  'Selected APIs · {count}': '選択した API · {count}',
  'Manage APIs for {name}': '{name} の API を管理',
  'Owner access cannot be restricted.': 'オーナーのアクセスは制限できません。',
  'Owner reviews a tenant for each protected action.':
    'オーナーは保護された操作ごとにテナントを確認します。',
  'Assigned tenant': '割り当てられたテナント',
  'Manage tenant for {name}': '{name} のテナントを管理',
  'Viewer · read APIs': '閲覧者 · API を閲覧',
  'Editor · build and test': '編集者 · 作成とテスト',
  '{name} · custom role': '{name} · カスタムロール',
  'Role for {name}': '{name} のロール',
  "Change {name}'s role from {current} to {next}? This ends their active browser sessions. Their member key immediately uses the new permissions.":
    '{name} のロールを {current} から {next} に変更しますか？そのメンバーの有効なブラウザーセッションは終了します。メンバーキーには新しい権限がすぐに適用されます。',
  'Member role updated. Their browser sessions were ended.':
    'メンバーのロールを更新しました。そのメンバーのブラウザーセッションは終了しました。',
  'Could not update member role.': 'メンバーのロールを更新できませんでした。',
  'Change role': 'ロールを変更',
  'Selected APIs only': '選択した API のみ',
  'Selected sharing limits API scope. Use Viewer or a custom role with only API, runtime-key and load-test actions. Actions still require separate role grants. It grants no API creation or global resource management.':
    '選択した API の共有は API の範囲を制限します。閲覧者、または API・ランタイムキー・負荷テストの操作のみを持つカスタムロールを使ってください。操作には引き続き個別のロール権限が必要です。API の新規作成やワークスペース全体のリソース管理の権限は付与されません。',
  'This role has actions beyond Read APIs and selected API operations. Choose an eligible custom role or Viewer, or explicitly select All APIs before continuing.':
    'このロールには API の閲覧と選択した API の操作以外の権限があります。対応するカスタムロールまたは閲覧者を選ぶか、すべての API を明示的に選択してから続行してください。',
  'Choose APIs to share': '共有する API を選択',
  'Share {name}': '{name} を共有',
  '{count} APIs selected.': '{count} 個の API を選択しています。',
  'No APIs selected. This member can sign in, but sees no APIs.':
    'API が選択されていません。このメンバーはログインできますが、API は表示されません。',
  'Dependencies these APIs may use': 'これらの API が使用できる依存先',
  'USE permits these selected APIs to read chosen dependency data or trigger product login when the role allows testing, publishing or callers. It can expose stored data through the API. It grants no dependency preview or management. Row, column and tenant authorization remain separate; selecting APIs or dependencies does not provide them.':
    'USE は、ロールがテスト・公開・呼び出しを許可している場合に、選択した API が指定した依存先のデータを読み取ることやプロダクトのログインを実行することを許可します。API を通じて保存済みデータが公開される可能性があります。依存先のプレビューや管理の権限は付与されません。行・列・テナントの認可は別であり、API や依存先を選択しても付与されません。',
  'Use spreadsheet sources': 'スプレッドシートのデータソースを使用',
  'Use SQLite copies': 'SQLite コピーを使用',
  'Use product login connections': 'プロダクトのログイン接続を使用',
  'Use spreadsheet {name}': 'スプレッドシート {name} を使用',
  'Use SQLite copy {name}': 'SQLite コピー {name} を使用',
  'Use product login {name}': 'プロダクトのログイン {name} を使用',
  'Structure only · version {version}': '構造のみ · バージョン {version}',
  'No saved dependencies in this group.':
    'このグループに保存済みの依存先はありません。',
  '{count} dependencies allowed for USE.':
    '{count} 個の依存先で USE を許可しています。',
  'All current and future APIs. Actions still follow the assigned role.':
    '現在および今後のすべての API。操作には引き続き割り当てられたロールの権限が適用されます。',
  'Custom roles': 'カスタムロール',
  'New role': '新しいロール',
  'Choose actions for this local workspace. Every member can manage their own account and sessions. Member and role administration stays with the owner.':
    'このローカルワークスペースで実行できる操作を選択します。すべてのメンバーは自分のアカウントとセッションを管理できます。メンバーとロールの管理はオーナーのみが行えます。',
  'Actions are separate: editing, testing, and publication each need their own grant. Reading related APIs or connections is needed to choose them in forms.':
    '編集、テスト、公開はそれぞれ別の操作で、個別の権限が必要です。フォームで関連する API や接続を選ぶには、それらの閲覧権限が必要です。',
  'Loading permission choices…': '権限の選択肢を読み込み中…',
  'Retry permission choices': '権限の選択肢を再読み込み',
  'Save changes to {name}? Changed grants apply immediately to member keys and end affected browser sessions. Review all selected permissions before continuing.':
    '{name} の変更を保存しますか？変更した権限はメンバーキーにすぐ適用され、影響を受けるブラウザーセッションは終了します。続行する前に、選択したすべての権限を確認してください。',
  'Role updated. Changed grants end affected browser sessions.':
    'ロールを更新しました。権限の変更により、影響を受けるブラウザーセッションは終了します。',
  'Role created. Assign it to a member when ready.':
    'ロールを作成しました。準備ができたらメンバーに割り当ててください。',
  'Could not save role.': 'ロールを保存できませんでした。',
  'Edit {name} · version {version}': '{name} を編集 · バージョン {version}',
  'Create custom role': 'カスタムロールを作成',
  'Role name': 'ロール名',
  'No workspace action grants. Members with this role can still sign in and manage their own account.':
    'ワークスペースの操作権限はありません。このロールのメンバーもログインし、自分のアカウントを管理できます。',
  'Backup access exposes the entire workspace, including saved data and sensitive credential records. Keep downloads private.':
    'バックアップへのアクセスにより、保存済みデータや機密性の高い認証情報の記録を含むワークスペース全体が公開されます。ダウンロードしたファイルは非公開で保管してください。',
  'Load testing repeatedly executes live APIs. Configured writes can change product data. Grant only to trusted operators.':
    '負荷テストは稼働中の API を繰り返し実行します。設定された書き込み処理によってプロダクトのデータが変更される場合があります。信頼できる担当者にのみ権限を付与してください。',
  'Save role': 'ロールを保存',
  'Cancel role changes': 'ロールの変更をキャンセル',
  'If another owner session changes this role, refresh the members page and reopen the role before saving again.':
    '別のオーナーセッションがこのロールを変更した場合は、メンバーページを再読み込みし、ロールを開き直してから再度保存してください。',
  'Custom · v{version}': 'カスタム · v{version}',
  'Account and own sessions only': '自分のアカウントとセッションのみ',
  'Edit {name}': '{name} を編集',
  'Delete role {name}? This cannot be undone. Roles assigned to members cannot be deleted.':
    'ロール {name} を削除しますか？この操作は元に戻せません。メンバーに割り当てられているロールは削除できません。',
  'Role deleted.': 'ロールを削除しました。',
  'Could not delete role.': 'ロールを削除できませんでした。',
  'Delete {name}': '{name} を削除',
  'No custom roles yet. Built-in owner, editor, and viewer roles stay available.':
    'カスタムロールはまだありません。組み込みのオーナー、編集者、閲覧者ロールは引き続き利用できます。',
  'Read APIs': 'API を閲覧',
  'Edit APIs': 'API を編集',
  'Test drafts': '下書きをテスト',
  'Publish and roll back': '公開とロールバック',
  'Read data sources': 'データソースを閲覧',
  'Manage data sources': 'データソースを管理',
  'Read database copies': 'データベースコピーを閲覧',
  'Manage database copies': 'データベースコピーを管理',
  'Read product login connections': 'プロダクトログイン接続を閲覧',
  'Manage product login connections': 'プロダクトログイン接続を管理',
  'Manage runtime API keys': 'ランタイム API キーを管理',
  'Read audit history': '監査履歴を閲覧',
  'Manage workspace backups': 'ワークスペースのバックアップを管理',
  'Read migration history': '移行履歴を閲覧',
  'Run load tests': '負荷テストを実行',
  APIs: 'API',
  Databases: 'データベース',
  Security: 'セキュリティ',
  'Read authorized API drafts, release history, OpenAPI documents, client examples, and generated backend source.':
    'アクセスを許可された API の下書き、リリース履歴、OpenAPI ドキュメント、クライアントコード例、生成されたバックエンドソースを閲覧します。',
  'Create and save API drafts. Selected access permits editing existing shared APIs with explicit dependency use, but cannot create APIs.':
    'API の下書きを作成・保存します。選択された API へのアクセスでは、依存リソースの明示的な USE 権限があれば既存の共有 API を編集できますが、API は作成できません。',
  'Execute saved REST and GraphQL drafts, including their configured data and product-login steps. Selected access also requires explicit dependency use.':
    '設定されたデータ処理やプロダクトログインのステップを含む、保存済みの REST と GraphQL の下書きを実行します。選択された API へのアクセスでは、依存リソースの明示的な USE 権限も必要です。',
  'Change live API behavior by publishing drafts or rolling back releases.':
    '下書きの公開やリリースのロールバックにより、稼働中の API の動作を変更します。',
  'Read source metadata and saved rows.':
    'データソースのメタデータと保存済みの行を閲覧します。',
  'Import, replace, refresh, and delete sources. Replacing data changes what published APIs read.':
    'データソースのインポート、置き換え、更新、削除を行います。データの置き換えにより、公開済み API が読み取る内容が変わります。',
  'Read uploaded SQLite copy metadata and selected rows. Generated APIs may expose their configured data.':
    'アップロードされた SQLite コピーのメタデータと選択された行を閲覧します。生成された API は、設定されたデータを公開する場合があります。',
  'Upload, check, and delete immutable SQLite copies. Workspace backups include all uploaded data.':
    '変更不可の SQLite コピーをアップロード、確認、削除します。ワークスペースのバックアップには、アップロードされたすべてのデータが含まれます。',
  'Read product-login connection metadata without provider secrets.':
    'プロバイダーのシークレットを除く、プロダクトログイン接続のメタデータを閲覧します。',
  'Create, update, and delete server-held provider credentials. Changes affect live product login.':
    'サーバーに保存されたプロバイダーの認証情報を作成、更新、削除します。変更は稼働中のプロダクトログインに影響します。',
  'Issue, list, replace, and revoke runtime keys. Selected access manages issuer-bound keys for shared APIs; issuance and replacement require dependency use and preserve release pins.':
    'ランタイムキーを発行、一覧表示、置き換え、失効します。選択された API へのアクセスでは、共有 API の発行者に紐づいたキーを管理します。発行と置き換えには依存リソースの USE 権限が必要で、リリースピンは維持されます。',
  'Read workspace activity and security events.':
    'ワークスペースの操作履歴とセキュリティイベントを閲覧します。',
  'Create, list, and download complete workspace backups containing saved data and sensitive credential records.':
    '保存済みデータと機密性の高い認証情報の記録を含む、ワークスペース全体のバックアップを作成、一覧表示、ダウンロードします。',
  'Read the control database migration history.':
    '管理用データベースの移行履歴を閲覧します。',
  'List published targets and load-test history; start and cancel bounded local runs. Runs execute published APIs and may cause their configured writes.':
    '公開済みの対象と負荷テスト履歴を一覧表示し、制限付きのローカル実行を開始・キャンセルします。実行では公開済み API が呼び出され、設定された書き込み処理が行われる場合があります。',
  'Update available': '新しいバージョンがあります',
  'No newer release found': '新しいリリースは見つかりませんでした',
  'No matching releases found': '設定に一致するリリースは見つかりませんでした',
  'Release check failed': 'リリースの確認に失敗しました',
  'Owner access required to manage Besh updates.':
    'Besh の更新管理にはオーナー権限が必要です。',
  'Could not load update information.': '更新情報を読み込めませんでした。',
  'YOUR BESH INSTALLATION': 'インストール済みの BESH',
  'Besh updates': 'Besh の更新',
  'Check public GitHub releases when you are ready.':
    '準備ができたら GitHub の公開リリースを確認してください。',
  'Discard unsaved update settings and refresh?':
    '未保存の更新設定を破棄して再読み込みしますか？',
  'Refresh update settings': '更新設定を再読み込み',
  'Loading update settings…': '更新設定を読み込み中…',
  'Update settings saved. Check releases to get a fresh result.':
    '更新設定を保存しました。最新の結果を取得するにはリリースを確認してください。',
  'Release settings': 'リリース設定',
  'GitHub repository': 'GitHub リポジトリ',
  'Use a public repository URL. Private repositories and access tokens are not supported.':
    '公開リポジトリの URL を使用してください。非公開リポジトリやアクセストークンには対応していません。',
  'Include preview releases': 'プレビューリリースを含める',
  'Show alpha, beta and other prereleases alongside stable versions.':
    '安定版とともに alpha、beta などのプレリリースを表示します。',
  'Save update settings': '更新設定を保存',
  'Save your changes before checking releases.':
    'リリースを確認する前に変更を保存してください。',
  'Release status': 'リリースの状態',
  'Installed {version}': 'インストール済み：{version}',
  'No release check yet': 'リリースはまだ確認していません',
  'Last checked {date}': '最終確認：{date}',
  'Preview release': 'プレビューリリース',
  'View GitHub release': 'GitHub のリリースを見る',
  'A check runs only when you choose it. Opening this page uses saved information.':
    '確認は自分で選んだときだけ実行されます。このページを開くと保存済みの情報が表示されます。',
  'Release check finished. Review the result below.':
    'リリースの確認が完了しました。以下の結果を確認してください。',
  'Check releases': 'リリースを確認',
  'One check per minute. Checks inspect the first 20 published GitHub releases.':
    '確認は1分に1回です。GitHub に公開された最初の20件のリリースを調べます。',
  'This page reports versions. It does not install updates or verify release compatibility. Review release notes and back up data before upgrading.':
    'このページはバージョン情報を表示します。更新のインストールやリリースの互換性確認は行いません。アップグレード前にリリースノートを読み、データをバックアップしてください。',
  'Only the owner can manage Besh release settings and update notices.':
    'Besh のリリース設定と更新通知を管理できるのはオーナーのみです。',
  'YOUR WORKSPACE ACCESS': 'ワークスペースへのアクセス',
  'Manage your email sign-in and active browser sessions.':
    'メールでのログイン情報と有効なブラウザーセッションを管理します。',
  'Loading your account…': 'アカウントを読み込み中…',
  'Sign-in details saved. Other browser sessions were revoked.':
    'ログイン情報を保存しました。他のブラウザーセッションは失効しました。',
  'Could not save sign-in details.': 'ログイン情報を保存できませんでした。',
  'Optional. Your workspace key still works. Saving new details signs out your other browser sessions.':
    '設定は任意です。ワークスペースキーは引き続き使えます。新しい情報を保存すると、他のブラウザーセッションからログアウトします。',
  'Account email': 'アカウントのメールアドレス',
  'Use 12 to 128 characters.': '12〜128文字で入力してください。',
  'Confirm your identity': '本人確認',
  'Current password': '現在のパスワード',
  'Your workspace key': 'ワークスペースキー',
  'Save sign-in details': 'ログイン情報を保存',
  'Active sessions': '有効なセッション',
  'Owners can revoke sessions across this workspace.':
    'オーナーはこのワークスペース内のセッションを失効させることができます。',
  'Only your own active sessions appear here.':
    '自分の有効なセッションのみが表示されます。',
  'Session expires {date}.': 'セッションの有効期限：{date}。',
  'Refresh sessions': 'セッションを更新',
  Member: 'メンバー',
  Device: '端末',
  'Last active': '最終利用日時',
  Expires: '有効期限',
  Access: 'アクセス',
  'This device': 'この端末',
  'Other browser session': '他のブラウザーセッション',
  'Revoke session for {name} on this device':
    'この端末での {name} のセッションを失効',
  'Revoke session for {name}': '{name} のセッションを失効',
  'Revoke this session and sign out?':
    'このセッションを失効させてログアウトしますか？',
  'Revoke this browser session for {name}?':
    '{name} のこのブラウザーセッションを失効させますか？',
  'This session was revoked. Sign in again.':
    'このセッションは失効しました。再度ログインしてください。',
  'Browser session revoked.': 'ブラウザーセッションを失効させました。',
  Revoke: '失効',
  'No active sessions.': '有効なセッションはありません。',
  Language: '言語',
  'Use device language': '端末の言語を使用',
  Appearance: '外観',
  Light: 'ライト',
  Dark: 'ダーク',
  System: 'システム',
  'API Studio': 'API スタジオ',
  'Data sources': 'データソース',
  'Database connections': 'データベース接続',
  'Product login': 'プロダクトのログイン',
  'Load testing': '負荷テスト',
  'Audit trail': '監査ログ',
  Members: 'メンバー',
  'Tenant protection': 'テナント保護',
  'API keys': 'API キー',
  'Account & sessions': 'アカウントとセッション',
  'Data & backups': 'データとバックアップ',
  Updates: 'アップデート',
  'What’s next': '今後の予定',
  Workspace: 'ワークスペース',
  'Local workspace': 'ローカルワークスペース',
  WORKSPACE: 'ワークスペース',
  'YOUR APIS': 'あなたの API',
  'New API': '新しい API',
  'Workspace navigation': 'ワークスペースのナビゲーション',
  'Sign out': 'ログアウト',
  'Working…': '処理中…',
  'Opening your workspace…': 'ワークスペースを開いています…',
  'Opening invitation…': '招待を開いています…',
  'Opening studio…': 'スタジオを開いています…',
  'Try again': 'もう一度試す',
  'Help & roadmap': 'ヘルプとロードマップ',
  'Drafts stay separate from published APIs':
    '下書きは公開済み API と分離されています',
  'No APIs shared': '共有された API はありません',
  'Permission required': '権限が必要です',
  'Owner access required': 'オーナー権限が必要です',
  'Editor access required': '編集権限が必要です',
  Save: '保存',
  Cancel: 'キャンセル',
  Close: '閉じる',
  Refresh: '更新',
  Search: '検索',
  'API tools': 'API ツール',
  'Review details': '詳細を確認',
  'Besh home': 'Besh ホーム',
  'A SPACE FOR YOUR NEXT IDEA': '次のアイデアのための場所',
  'Your next API.': 'あなたの次の API。',
  'Clearly connected.': 'つながりを、わかりやすく。',
  'Turn an idea into an endpoint. Build visually, test your flow, and publish when you’re ready.':
    'アイデアを API に。視覚的に組み立て、フローをテストし、準備ができたら公開しましょう。',
  'Start with a simple request.': 'シンプルなリクエストから始めましょう。',
  'Ask for exactly what you need.': '必要なものだけをリクエスト。',
  'JSON response': 'JSON レスポンス',
  Request: 'リクエスト',
  Response: 'レスポンス',
  'Your workspace. Your APIs. Private by default.':
    'あなたのワークスペース。あなたの API。初期設定で非公開。',
  '02 / SAVE YOUR KEY': '02 / キーを保存',
  '01 / MAKE IT YOURS': '01 / あなたの設定に',
  'WELCOME BACK': 'おかえりなさい',
  'Your workspace is ready.': 'ワークスペースの準備ができました。',
  'A little setup. A lot of possibility.': '少しの設定で、たくさんの可能性。',
  'Open your workspace.': 'ワークスペースを開きましょう。',
  'Keep this owner key safe. It is shown once.':
    'このオーナーキーを安全に保管してください。表示は一度だけです。',
  'Choose a name for your workspace. We’ll create an owner key so you can get started.':
    'ワークスペースに名前を付けましょう。開始するためのオーナーキーを作成します。',
  'Sign in with email and password, or your owner or member key. Configure email sign-in in Account & sessions.':
    'メールとパスワード、またはオーナー・メンバーキーでログインします。メールでのログインは「アカウントとセッション」で設定できます。',
  'Sign-in method': 'ログイン方法',
  'Workspace key': 'ワークスペースキー',
  'Email & password': 'メールとパスワード',
  'Workspace name': 'ワークスペース名',
  'Setup key': 'セットアップキー',
  'Open the setup link printed in your server terminal.':
    'サーバーのターミナルに表示された設定リンクを開いてください。',
  'Visual API Studio': 'ビジュアル API スタジオ',
  'Separate drafts and releases': '下書きと公開版を分離',
  'Private workspace': '非公開ワークスペース',
  Email: 'メール',
  Password: 'パスワード',
  'Your owner key': 'あなたのオーナーキー',
  'Workspace token': 'ワークスペーストークン',
  'Copy owner key': 'オーナーキーをコピー',
  'I saved my owner key': 'オーナーキーを保存しました',
  'Your key creates a private browser session. The key is discarded after sign-in.':
    'キーでプライベートなブラウザーセッションを作成します。ログイン後、キーは破棄されます。',
  'Enter studio': 'スタジオに入る',
  'Create workspace': 'ワークスペースを作成',
  'Open workspace': 'ワークスペースを開く',
  'A small start. Something worth building.':
    '小さな一歩から、価値あるものを。',
  'Workspace created. Save your owner key.':
    'ワークスペースを作成しました。オーナーキーを保存してください。',
  'Owner key copied.': 'オーナーキーをコピーしました。',
  'YOUR WORKSPACE INVITATION': 'ワークスペースへの招待',
  'Your workspace invite.': 'ワークスペースへの招待。',
  'Set up email sign-in for your existing member. Your role and API access do not change.':
    '既存メンバーのメールログインを設定します。ロールと API のアクセス権は変わりません。',
  'Accept invitation': '招待を受け入れる',
  'Password set': 'パスワードを設定しました',
  'Email sign-in is ready for {email}. You are not signed in yet.':
    '{email} のメールログインを設定しました。まだログインしていません。',
  'Sign in': 'ログイン',
  'Reading invitation…': '招待を読み込んでいます…',
  'Check invitation': '招待を確認',
  'Selected APIs': '選択した API',
  'All APIs': 'すべての API',
  'Expires {date}.': '有効期限：{date}。',
  'Current sign-in': '現在のログイン',
  'Checking current sign-in…': '現在のログインを確認しています…',
  'You are signed in as {name}. Sign out explicitly before setting this member’s password.':
    '現在 {name} としてログインしています。このメンバーのパスワードを設定する前にログアウトしてください。',
  'Sign out to accept invitation': 'ログアウトして招待を受け入れる',
  'Return to workspace': 'ワークスペースに戻る',
  'No workspace sign-in is active.': 'ワークスペースにログインしていません。',
  'Check current sign-in': '現在のログインを確認',
  'New password': '新しいパスワード',
  'Invitation password': '新しいパスワード',
  'Confirm password': 'パスワードを確認',
  'Confirm invitation password': 'パスワードを確認',
  'Use 12 to 128 characters. Your existing workspace key still works.':
    '12〜128 文字で設定してください。既存のワークスペースキーも引き続き使えます。',
  'Set password': 'パスワードを設定',
  'Leave invitation and sign in': '招待を閉じてログイン',
  'Discard unsaved draft changes and sign out to accept this invitation?':
    '未保存の下書き変更を破棄してログアウトし、この招待を受け入れますか？',
  'Passwords must match.': 'パスワードが一致している必要があります。',
  'Could not read invitation.': '招待を読み込めませんでした。',
  'Could not read your current sign-in.':
    '現在のログインを確認できませんでした。',
  'Current sign-in unknown. Check it before setting a password.':
    '現在のログイン状態が不明です。パスワード設定の前に確認してください。',
  'Could not confirm sign-out. Check current sign-in before continuing; no automatic retry was made.':
    'ログアウトを確認できませんでした。続ける前にログイン状態を確認してください。自動再試行はしていません。',
  'Could not confirm password setup.': 'パスワード設定を確認できませんでした。',
  'No automatic retry was made. Try ordinary email sign-in if it may have succeeded, or ask the owner to refresh invitations and review a new link.':
    '自動再試行はしていません。成功した可能性がある場合は通常のメールログインを試すか、オーナーに招待の更新と新しいリンクの確認を依頼してください。',
  'Sign-in invitation': 'ログインへの招待',
  Invitations: '招待',
  'Set up email sign-in for an existing key-only member. Their role, API access and tenant assignment stay unchanged. Existing accounts cannot be reset with an invitation.':
    'キーのみを使う既存メンバーのメールログインを設定します。ロール、API 権限、テナント割り当ては変わりません。招待で既存アカウントをリセットすることはできません。',
  'Refresh invitations': '招待を更新',
  'Loading invitations…': '招待を読み込み中…',
  'Current invitations unknown. Refresh needed.':
    '現在の招待が不明です。更新してください。',
  'Existing member': '既存のメンバー',
  'Invitation member': '既存のメンバー',
  'Invitation email': '招待先メール',
  'Expires in 24 hours. Besh does not send email.':
    '24 時間で期限切れになります。Besh はメールを送信しません。',
  'Anyone holding the link can set this member’s password. It does not prove email ownership. Share it privately. Creating another link invalidates this member’s earlier invitation; their workspace key still works.':
    'リンクを持つ人はこのメンバーのパスワードを設定できます。メールの所有を証明するものではありません。非公開で共有してください。新しいリンクを作ると以前の招待は無効になりますが、ワークスペースキーは引き続き使えます。',
  'Create invitation link': '招待リンクを作成',
  'Save this invitation link': 'この招待リンクを保存',
  'Link status unconfirmed. Refresh invitations before sharing it.':
    'リンクの状態を確認できていません。共有前に招待を更新してください。',
  'Current pending invitation.': '現在の未承諾の招待です。',
  'This invitation is no longer active. Its link cannot set a password.':
    'この招待は無効になりました。リンクではパスワードを設定できません。',
  'Invitation link': '招待リンク',
  'Copy invitation link': '招待リンクをコピー',
  'I saved the link': 'リンクを保存しました',
  'Pending invitations': '未承諾の招待',
  'Refresh to read current pending invitations.':
    '更新して現在の未承諾の招待を確認してください。',
  'Revoke invitation': '招待を取り消す',
  'No pending invitations.': '未承諾の招待はありません。',
  'Close invitations': '招待を閉じる',
  'Could not read invitations.': '招待を読み込めませんでした。',
  'Refresh invitations before changing a link.':
    'リンクを変更する前に招待を更新してください。',
  'Refresh invitations before trying again.':
    '再試行する前に招待を更新してください。',
  'Could not confirm whether the invitation was created. Refresh invitations to review current links before reissuing or revoking.':
    '招待の作成を確認できませんでした。再発行や取り消しの前に招待を更新し、現在のリンクを確認してください。',
  'Could not confirm whether the invitation was revoked. Refresh invitations before changing another link.':
    '招待の取り消しを確認できませんでした。他のリンクを変更する前に招待を更新してください。',
  'Invitation created. Copy the link; it is shown once.':
    '招待を作成しました。リンクをコピーしてください。表示は一度だけです。',
  'Invitation revoked. That link can no longer set a password.':
    '招待を取り消しました。このリンクではパスワードを設定できません。',
  'Invitation link copied.': '招待リンクをコピーしました。',
  'Invitation unavailable': '招待を利用できません',
  'Too many invitation attempts': '招待の試行回数が多すぎます',
  'Email address unavailable': 'このメールアドレスは利用できません',
  'Invitation state unavailable': '招待の状態を確認できません',
  'Choose a member and valid email address':
    'メンバーと有効なメールアドレスを指定してください',
  'Choose an existing member without an account':
    'アカウントのない既存メンバーを選択してください',
  'Pending invitation limit reached': '未承諾の招待数が上限に達しました',
  'Provide an invitation token': '招待トークンを指定してください',
  'Provide an invitation token and password of 12 to 128 characters':
    '招待トークンと 12〜128 文字のパスワードを指定してください',
  'Invalid credentials': '認証情報が正しくありません',
  'Too many login attempts': 'ログインの試行回数が多すぎます',
  'Enter a valid email address': '有効なメールアドレスを入力してください',
  'Password must contain 12 to 128 characters':
    'パスワードは 12〜128 文字で設定してください',
  'Email and password must be provided together':
    'メールとパスワードを両方指定してください',
  'Authentication required': 'ログインが必要です',
  'Permission denied': 'アクセス権がありません',
  'Workspace is shutting down': 'ワークスペースを終了しています',
  'Browser origin rejected': 'ブラウザーの接続元が拒否されました',
  'Session verification required': 'セッションの確認が必要です',
  'Your session expired. Sign in again.':
    'セッションの期限が切れました。再度ログインしてください。',
  'Your session expired or was revoked. Sign in again.':
    'セッションが期限切れ、または取り消されました。再度ログインしてください。',
  'Signed out. This session was revoked.':
    'ログアウトしました。このセッションは取り消されました。',
  'This session has already ended. Sign in again.':
    'このセッションは終了しました。再度ログインしてください。',
  'Workspace ready.': 'ワークスペースの準備ができました。',
  'Connect your first idea.': '最初のアイデアをつなげましょう。',
  'Request failed': 'リクエストに失敗しました',
  'Could not restore session.': 'セッションを復元できませんでした。',
  'Invitation link unavailable. Ask the owner for a new link.':
    '招待リンクを利用できません。オーナーに新しいリンクを依頼してください。',
  'nodePicker.open': 'ステップを追加',
  'Add step': 'ステップを追加',
  'nodePicker.title': 'ステップを選択',
  'Choose a step': 'ステップを選択',
  'nodePicker.search': 'ステップを検索',
  'Search steps': 'ステップを検索',
  'nodePicker.help':
    '下書きに追加するステップを選び、追加後にフィールドを設定してください。',
  'Choose a step for this draft. Configure its fields after adding.':
    '下書きに追加するステップを選び、追加後にフィールドを設定してください。',
  'nodePicker.all': 'すべてのステップ',
  'All steps': 'すべてのステップ',
  'nodePicker.favorites': 'お気に入り',
  Favorites: 'お気に入り',
  'nodePicker.empty': 'ステップが見つかりません。',
  'No steps found.': 'ステップが見つかりません。',
  'nodePicker.noFavorites': 'お気に入りのステップはまだありません。',
  'No favorite steps yet.': 'お気に入りのステップはまだありません。',
  'nodePicker.favorite': '{name} をお気に入りに追加',
  'Favorite {name}': '{name} をお気に入りに追加',
  'nodePicker.unfavorite': '{name} をお気に入りから削除',
  'Remove {name} from favorites': '{name} をお気に入りから削除',
  'nodePicker.add': '{name} を追加',
  'Add {name}': '{name} を追加',
  'nodePicker.close': 'ステップ選択を閉じる',
  'Close step picker': 'ステップ選択を閉じる',
  'nodePicker.unavailable': 'この API では利用できません',
  'Unavailable for this API': 'この API では利用できません',
  'nodePicker.requestExists': 'この API にはリクエストステップがあります。',
  'This API already has a request step.':
    'この API にはリクエストステップがあります。',
  'nodePicker.category.api': 'API',
  API: 'API',
  'nodePicker.category.logic': 'ロジック',
  Logic: 'ロジック',
  'nodePicker.category.data': 'データ',
  Data: 'データ',
  'nodePicker.category.identity': 'プロダクトのログイン',
  'nodePicker.categories': 'ステップのカテゴリ',
  'Step categories': 'ステップのカテゴリ',
  'nodePicker.results': '一致するステップ',
  'Matching steps': '一致するステップ',
  'nodes.request.label': 'HTTP リクエスト',
  'HTTP request': 'HTTP リクエスト',
  'nodes.request.description': 'API を開始し、入力を受け取ります。',
  'Start the API and receive its input.': 'API を開始し、入力を受け取ります。',
  'nodes.response.label': 'JSON レスポンス',
  'nodes.response.description': 'API の結果を呼び出し元に返します。',
  'Send the API result back to its caller.':
    'API の結果を呼び出し元に返します。',
  'nodes.condition.label': '条件',
  Condition: '条件',
  'nodes.condition.description': '入力値を比較して次の経路を選びます。',
  'Compare an input value and choose the next path.':
    '入力値を比較して次の経路を選びます。',
  'nodes.data.label': 'スプレッドシートの行',
  'Spreadsheet rows': 'スプレッドシートの行',
  'nodes.data.description':
    'インポートした表や保存済み Google Sheet から選択したフィールドを読み取ります。',
  'Read chosen fields from an imported spreadsheet or saved Google Sheet.':
    'インポートした表や保存済み Google Sheet から選択したフィールドを読み取ります。',
  'nodes.database.label': 'SQLite の行',
  'SQLite rows': 'SQLite の行',
  'nodes.database.description':
    'アップロードした SQLite コピーから選択したフィールドを読み取ります。',
  'Read chosen fields from an uploaded SQLite copy.':
    'アップロードした SQLite コピーから選択したフィールドを読み取ります。',
  'nodes.social.label': 'GitHub ログイン',
  'GitHub login': 'GitHub ログイン',
  'nodes.social.description':
    'プロダクトの API に GitHub ログインを追加します。',
  'Add GitHub sign-in to the product API.':
    'プロダクトの API に GitHub ログインを追加します。',
  'nodes.wsRequest.label': 'メッセージを受信',
  'Receive message': 'メッセージを受信',
  'nodes.wsRequest.description':
    '型付き WebSocket メッセージを 1 件受信します。',
  'Receive one typed WebSocket message.':
    '型付き WebSocket メッセージを 1 件受信します。',
  'nodes.wsResponse.label': '返信を送信',
  'Send reply': '返信を送信',
  'nodes.wsResponse.description': '型付き WebSocket の返信を 1 件送信します。',
  'Send one typed WebSocket reply.':
    '型付き WebSocket の返信を 1 件送信します。',
  'API editing is unavailable.': 'API を編集できません。',
  'This API already has 64 steps.': 'この API にはすでに 64 ステップあります。',
  'This API already has a starting step.':
    'この API には開始ステップがあります。',
  'This step is unavailable for WebSocket request/reply.':
    'このステップは WebSocket のリクエスト・返信では使えません。',
  'This WebSocket API already has a reply step.':
    'この WebSocket API には返信ステップがあります。',
  'WebSocket request/reply supports one data read.':
    'WebSocket のリクエスト・返信ではデータを 1 回読み取れます。',
  Draft: '下書き',
  'Unsaved changes': '未保存の変更',
  Saved: '保存済み',
  'Save draft': '下書きを保存',
  Publish: '公開',
  'API name': 'API 名',
  'API NAME': 'API 名',
  'API TYPE': 'API の種類',
  'API type': 'API の種類',
  METHOD: 'メソッド',
  'HTTP method': 'HTTP メソッド',
  'ENDPOINT PATH': 'エンドポイントのパス',
  'Endpoint path': 'エンドポイントのパス',
  'Test flow': 'フローをテスト',
  'Request input': 'リクエストの入力',
  'Apply configuration': '設定を適用',
  'Remove node': 'ノードを削除',
  'Advanced configuration': '詳細設定',
  'Node configuration': 'ノード設定',
  'Create your first API': '最初の API を作成',
  'Start with a spreadsheet': 'スプレッドシートから開始',
  'Build a blank API': '空の API を作成',
  'Response status': 'レスポンスのステータス',
  'Response contents': 'レスポンスの内容',
  'Response fields': 'レスポンスのフィールド',
  'Rows from data step': 'データステップの行',
  'GitHub login result': 'GitHub ログインの結果',
  'Input source': '入力元',
  'Input field': '入力フィールド',
  Comparison: '比較',
  Equals: '等しい',
  'Expected type': '期待する型',
  'Expected value': '期待する値',
  Text: 'テキスト',
  Number: '数値',
  'True or false': '真または偽',
  'Empty value': '空の値',
  'Request body': 'リクエスト本文',
  'Query parameter': 'クエリパラメーター',
  'Path parameter': 'パスパラメーター',
  'From request body': 'リクエスト本文から',
  'From query parameter': 'クエリパラメーターから',
  'From path parameter': 'パスパラメーターから',
  'Nested data (preserved)': '入れ子のデータ（保持）',
  True: '真',
  False: '偽',
  'Path parameters': 'パスパラメーター',
  'Query parameters': 'クエリパラメーター',
  'Request body fields': 'リクエスト本文のフィールド',
  'Add query parameter': 'クエリパラメーターを追加',
  'Add body field': '本文フィールドを追加',
  'Add response field': 'レスポンスフィールドを追加',
  '{prefix} name {number}': '{prefix} の名前 {number}',
  '{prefix} type {number}': '{prefix} の型 {number}',
  '{prefix} value {number}': '{prefix} の値 {number}',
  'Remove {prefix} field {number}': '{prefix} フィールド {number} を削除',
  'Path parameter {name}': 'パスパラメーター {name}',
  'Value for :{name}': ':{name} の値',
  Field: 'フィールド',
  Body: '本文',
  Query: 'クエリ',
  'Finish opening your workspace or the current action, then reopen the invitation link. Your draft was kept.':
    'ワークスペースの起動や現在の操作が完了してから招待リンクを再度開いてください。下書きは保持されています。',
  'Leave the editor to review this invitation? Your unsaved draft will be kept until you return or confirm sign-out.':
    'エディターを離れてこの招待を確認しますか？戻るかログアウトを確認するまで、未保存の下書きは保持されます。',
  'Discard unsaved draft changes and open sign-in?':
    '未保存の下書き変更を破棄してログイン画面を開きますか？',
  'Workspace already configured': 'ワークスペースは設定済みです',
  'Open the setup link from your server terminal':
    'サーバーのターミナルから設定リンクを開いてください',
  'HTTPS browser origin required': 'ブラウザーの接続元は HTTPS が必要です',
  'Invitation revocation takes no fields':
    '招待の取り消しにフィールドは不要です',
  'Request failed ({status}).': 'リクエストに失敗しました（{status}）。',
  'Invalid request': 'リクエストが正しくありません',
  'Invalid request body': 'リクエスト本文が正しくありません',
  'REST API': 'REST API',
  'GraphQL API': 'GraphQL API',
  'Remove field {number}': 'フィールド {number} を削除',
  'NODE SETTINGS': 'ノード設定',
  'BUILD SOMETHING USEFUL': '役立つものを作ろう',
  'Connect the dots. Let your API do the work.':
    'ステップをつなぎ、API に仕事を任せましょう。',
  'API key protected': 'API キーで保護',
  'Published endpoint URL': '公開済みエンドポイントの URL',
  'Flow canvas': 'フローキャンバス',
  'New draft': '新しい下書き',
  'Try it out': '試してみる',
  'WAITING FOR A RUN': '実行を待っています',
  'Use this API': 'この API を使う',
  'Generated backend': '生成されたバックエンド',
  'Your API starts here': 'API はここから始まります',
  'Choose a path': '経路を選択',
  'Send something back': '結果を返しましょう',
  'Read selected columns': '選択した列を読み取る',
  'Read an uploaded copy': 'アップロードしたコピーを読む',
  'Resolve a product identity': 'プロダクトのユーザーを識別',
  'Data source': 'データソース',
  'Maximum rows': '最大行数',
  'Filter rows': '行を絞り込む',
  'Match one column': '1 列で照合',
  'Match column': '照合する列',
  'Match value type': '照合値の型',
  'Fixed text': '固定テキスト',
  'Fixed number': '固定数値',
  'Match value': '照合値',
  'Include {name}': '{name} を含める',
  'API field: {name}': 'API フィールド：{name}',
  'Small steps. Powerful APIs.': '小さなステップで、強力な API。',
  'Build a flow you can understand, test, and trust.':
    '理解でき、テストでき、信頼できるフローを作りましょう。',
  owner: 'オーナー',
  editor: '編集者',
  viewer: '閲覧者',
  'Unknown role': '不明なロール',
  'Custom role': 'カスタムロール',
  'Loading saved source details…': '保存済みデータソースの詳細を読み込み中…',
  'No saved sources are available. Import a spreadsheet in Data sources, then return to this step.':
    '保存済みデータソースはありません。「データソース」でスプレッドシートを取り込み、このステップに戻ってください。',
  'No allowed sources are available. Ask the owner to review source USE for your selected APIs.':
    '利用を許可されたデータソースはありません。共有された API のデータソース USE 権限を所有者に確認してもらってください。',
  'Choose a saved source to configure this step.':
    '保存済みデータソースを選び、このステップを設定してください。',
  'Source details could not be loaded. Check the error above.':
    'データソースの詳細を読み込めませんでした。上のエラーを確認してください。',
  'Source access is required. Ask the owner to review your permissions and source USE.':
    'データソースへのアクセスが必要です。権限とデータソース USE 権限を所有者に確認してもらってください。',
  'No sources are available to this account. Ask the owner to provide a source.':
    'このアカウントで利用できるデータソースはありません。所有者にデータソースの提供を依頼してください。',
  'Start with your spreadsheet, or build a blank API using the request and response below. Opening either path does not save or publish an API. You choose when to create or save its draft.':
    'スプレッドシートから始めるか、下のリクエストとレスポンスを使って空の API を作成します。どちらを開いても API は保存・公開されません。下書きを作成・保存するタイミングは自分で選べます。',
  'Your next idea starts here.': '次のアイデアはここから始まります。',
  'Create your first API.': '最初の API を作成しましょう。',
  'Live · v{version}': '公開中 · v{version}',
  'Saved · revision {revision}': '保存済み · リビジョン {revision}',
  '{nodes} nodes · {connections} connections':
    'ノード {nodes} 個 · 接続 {connections} 本',
  'Use /v1/customers/:id for a versioned route with a path parameter. Each :name occupies a whole route segment.':
    'バージョン付きでパスパラメーターを使うルートには /v1/customers/:id を指定します。各 :name はルートの 1 セグメント全体を占めます。',
  'Owner and member keys manage drafts. Create an API key in API keys to call a published endpoint.':
    'オーナーキーとメンバーキーは下書きの管理に使います。公開済みエンドポイントを呼び出すには「API キー」で API キーを作成してください。',
  'REQUEST DETAILS': 'リクエストの詳細',
  '// Save your draft, then run a test.\n// Your response will appear here.':
    '// 下書きを保存してからテストを実行してください。\n// レスポンスはここに表示されます。',
  'Discard unsaved draft changes?': '未保存の下書きの変更を破棄しますか？',
  'Use an exact path, such as /v1/customers. GraphQL arguments carry input values.':
    '/v1/customers などの完全なパスを指定してください。入力値は GraphQL の引数で渡します。',
  'GRAPHQL OPERATION': 'GRAPHQL オペレーション',
  'Use an exact path, such as /v1/messages. WebSocket messages carry input values; named path parameters are not supported.':
    '/v1/messages などの完全なパスを指定してください。入力値は WebSocket メッセージで渡します。名前付きパスパラメーターは使えません。',
  'YOUR DATA, YOUR API': 'あなたのデータ、あなたの API',
  'Create an API': 'API を作成',
  'Choose the fields people can receive. We will create a draft you can test and publish in API Studio.':
    '利用者に返すフィールドを選択してください。API Studio でテストして公開できる下書きを作成します。',
  '{endpoint} after publication. Use letters, numbers, slashes, hyphens, or underscores.':
    '公開後は {endpoint} を使用します。英字、数字、スラッシュ、ハイフン、アンダースコアを使用してください。',
  'Start with / and use letters, numbers, slashes, hyphens, or underscores.':
    '/ で始め、英字、数字、スラッシュ、ハイフン、アンダースコアを使用してください。',
  'Fields to return': '返すフィールド',
  'Original column → API field': '元の列 → API フィールド',
  'Return {column}': '{column} を返す',
  'Choose at least one field to continue.':
    '続行するには、少なくとも 1 つのフィールドを選択してください。',
  'Rows per request': 'リクエストごとの行数',
  'Up to {count} rows': '最大 {count} 行',
  'Filter by input': '入力値で絞り込む',
  'Match a supplied value, or return all rows when it is omitted.':
    '指定された値と一致する行を返します。値を省略すると、すべての行を返します。',
  'Filter column': '絞り込む列',
  'Filter input name': '絞り込み用の入力名',
  'Start with a lowercase letter. Use letters, numbers, or underscores.':
    '小文字の英字で始めてください。英字、数字、アンダースコアを使用してください。',
  'Callers send ?{input}=value in the URL. Omit it to return all rows. API keys control access to the API.':
    '呼び出し元は URL に ?{input}=value を指定します。省略すると、すべての行を返します。API キーで API へのアクセスを制御します。',
  'Callers supply {input} as an optional GraphQL query argument. Its type is created from the selected column. Omit it to return all rows; API keys control access.':
    '呼び出し元は {input} を任意の GraphQL クエリ引数として指定します。型は選択した列から生成されます。省略すると、すべての行を返します。API キーでアクセスを制御します。',
  'Create API from data': 'データから API を作成',
  'Discard unsaved draft changes and create this API?':
    '未保存の下書きの変更を破棄して、この API を作成しますか？',
  'API draft created. Test your data, then publish it.':
    'API の下書きを作成しました。データをテストしてから公開してください。',
  'API draft created. Read APIs access is needed to open API Studio.':
    'API の下書きを作成しました。API Studio を開くには API の読み取り権限が必要です。',
}

export default messages
