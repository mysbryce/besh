const messages: Record<string, string> = {
  'Your team': '팀',
  'WORKSPACE CONTROL': '작업 공간 관리',
  'Member keys manage the workspace. Use API keys for published endpoint callers.':
    '멤버 키는 작업 공간을 관리합니다. 게시된 엔드포인트를 호출할 때는 API 키를 사용하세요.',
  'Loading workspace records…': '작업 공간 기록을 불러오는 중…',
  'Only the owner can manage members and roles.':
    '소유자만 멤버와 역할을 관리할 수 있습니다.',
  'Refresh Members and review an active tenant before creating this member.':
    '이 멤버를 만들기 전에 멤버 페이지를 새로고침하고 활성 테넌트를 검토하세요.',
  'Create {name} with assigned tenant {tenant}? Protected API actions derive this identity. API permissions and dependency USE remain separate. This assignment and member credential are created together.':
    '테넌트 {tenant}를 할당하여 {name} 멤버를 만들까요? 보호된 API 작업은 이 할당에서 식별 정보를 가져옵니다. API 권한과 의존 항목 USE 권한은 별개입니다. 이 할당과 멤버 인증 정보는 함께 생성됩니다.',
  'Member created. Save their token; it is shown once.':
    '멤버를 만들었습니다. 토큰은 한 번만 표시되므로 저장하세요.',
  Name: '이름',
  'Member name': '멤버 이름',
  Role: '역할',
  'Member role': '멤버 역할',
  'Member email (optional)': '멤버 이메일 (선택 사항)',
  'Member password': '멤버 비밀번호',
  '12 to 128 characters. Leave email blank for key-only access.':
    '12~128자입니다. 키로만 접근하려면 이메일을 비워 두세요.',
  'New member API access': '새 멤버의 API 접근 권한',
  'New member tenant': '새 멤버의 테넌트',
  'No tenant assigned': '할당된 테넌트 없음',
  'Optional initial assignment. Review before adding the member; no separate credential creation and reassignment occurs.':
    '초기 할당은 선택 사항입니다. 멤버를 추가하기 전에 검토하세요. 인증 정보를 먼저 만들고 별도로 재할당하지 않습니다.',
  'Add member': '멤버 추가',
  'Save this member token': '이 멤버 토큰 저장',
  'New member token': '새 멤버 토큰',
  'Member token copied.': '멤버 토큰을 복사했습니다.',
  Copy: '복사',
  'I saved it': '저장했습니다',
  'Opening invitations…': '초대를 여는 중…',
  'API access': 'API 접근 권한',
  'Tenant identity': '테넌트 식별 정보',
  'Invite sign-in': '로그인 초대',
  'Bootstrap owner': '초기 설정 소유자',
  'Revoke access for {name}?': '{name}의 접근 권한을 취소할까요?',
  'Member access revoked.': '멤버 접근 권한을 취소했습니다.',
  'Selected APIs · {count}': '선택한 API · {count}',
  'Manage APIs for {name}': '{name}의 API 관리',
  'Owner access cannot be restricted.':
    '소유자의 접근 권한은 제한할 수 없습니다.',
  'Owner reviews a tenant for each protected action.':
    '소유자는 보호된 작업마다 테넌트를 검토합니다.',
  'Assigned tenant': '할당된 테넌트',
  'Manage tenant for {name}': '{name}의 테넌트 관리',
  'Viewer · read APIs': '뷰어 · API 읽기',
  'Editor · build and test': '편집자 · 만들기 및 테스트',
  '{name} · custom role': '{name} · 사용자 지정 역할',
  'Role for {name}': '{name}의 역할',
  "Change {name}'s role from {current} to {next}? This ends their active browser sessions. Their member key immediately uses the new permissions.":
    '{name}의 역할을 {current}에서 {next}(으)로 변경할까요? 해당 멤버의 활성 브라우저 세션이 종료됩니다. 멤버 키에는 새 권한이 즉시 적용됩니다.',
  'Member role updated. Their browser sessions were ended.':
    '멤버 역할을 업데이트했습니다. 해당 멤버의 브라우저 세션이 종료되었습니다.',
  'Could not update member role.': '멤버 역할을 업데이트하지 못했습니다.',
  'Change role': '역할 변경',
  'Selected APIs only': '선택한 API만',
  'Selected sharing limits API scope. Use Viewer or a custom role with only API, runtime-key and load-test actions. Actions still require separate role grants. It grants no API creation or global resource management.':
    '선택한 API 공유는 API 범위를 제한합니다. 뷰어 또는 API, 런타임 키, 부하 테스트 작업만 가진 사용자 지정 역할을 사용하세요. 작업에는 여전히 별도의 역할 권한이 필요합니다. API 생성이나 작업 공간 전체 리소스 관리 권한은 부여하지 않습니다.',
  'This role has actions beyond Read APIs and selected API operations. Choose an eligible custom role or Viewer, or explicitly select All APIs before continuing.':
    '이 역할에는 API 읽기와 선택한 API 작업 이외의 권한이 있습니다. 적합한 사용자 지정 역할 또는 뷰어를 선택하거나 모든 API를 명시적으로 선택한 뒤 계속하세요.',
  'Choose APIs to share': '공유할 API 선택',
  'Share {name}': '{name} 공유',
  '{count} APIs selected.': 'API {count}개를 선택했습니다.',
  'No APIs selected. This member can sign in, but sees no APIs.':
    '선택한 API가 없습니다. 이 멤버는 로그인할 수 있지만 API는 볼 수 없습니다.',
  'Dependencies these APIs may use': '이 API들이 사용할 수 있는 의존 항목',
  'USE permits these selected APIs to read chosen dependency data or trigger product login when the role allows testing, publishing or callers. It can expose stored data through the API. It grants no dependency preview or management. Row, column and tenant authorization remain separate; selecting APIs or dependencies does not provide them.':
    'USE는 역할이 테스트, 게시 또는 호출을 허용할 때 선택한 API가 지정된 의존 항목 데이터를 읽거나 제품 로그인을 시작할 수 있게 합니다. API를 통해 저장된 데이터가 노출될 수 있습니다. 의존 항목 미리보기나 관리 권한은 부여하지 않습니다. 행, 열, 테넌트별 접근 허가는 별개이며 API나 의존 항목을 선택한다고 부여되지 않습니다.',
  'Use spreadsheet sources': '스프레드시트 데이터 소스 사용',
  'Use SQLite copies': 'SQLite 복사본 사용',
  'Use product login connections': '제품 로그인 연결 사용',
  'Use spreadsheet {name}': '스프레드시트 {name} 사용',
  'Use SQLite copy {name}': 'SQLite 복사본 {name} 사용',
  'Use product login {name}': '제품 로그인 {name} 사용',
  'Structure only · version {version}': '구조만 · 버전 {version}',
  'No saved dependencies in this group.':
    '이 그룹에는 저장된 의존 항목이 없습니다.',
  '{count} dependencies allowed for USE.':
    '의존 항목 {count}개에 USE가 허용되었습니다.',
  'All current and future APIs. Actions still follow the assigned role.':
    '현재와 앞으로 생성될 모든 API입니다. 작업은 여전히 할당된 역할 권한을 따릅니다.',
  'Custom roles': '사용자 지정 역할',
  'New role': '새 역할',
  'Choose actions for this local workspace. Every member can manage their own account and sessions. Member and role administration stays with the owner.':
    '이 로컬 워크스페이스에서 허용할 작업을 선택하세요. 모든 멤버는 자신의 계정과 세션을 관리할 수 있습니다. 멤버와 역할 관리는 소유자만 할 수 있습니다.',
  'Actions are separate: editing, testing, and publication each need their own grant. Reading related APIs or connections is needed to choose them in forms.':
    '편집, 테스트, 게시는 서로 다른 작업이며 각각 별도의 권한이 필요합니다. 양식에서 관련 API나 연결을 선택하려면 해당 항목을 읽을 권한이 필요합니다.',
  'Loading permission choices…': '권한 선택 항목을 불러오는 중…',
  'Retry permission choices': '권한 선택 항목 다시 불러오기',
  'Save changes to {name}? Changed grants apply immediately to member keys and end affected browser sessions. Review all selected permissions before continuing.':
    '{name}의 변경 사항을 저장할까요? 변경된 권한은 멤버 키에 즉시 적용되며 영향을 받는 브라우저 세션이 종료됩니다. 계속하기 전에 선택한 모든 권한을 확인하세요.',
  'Role updated. Changed grants end affected browser sessions.':
    '역할을 업데이트했습니다. 권한 변경으로 영향을 받는 브라우저 세션이 종료됩니다.',
  'Role created. Assign it to a member when ready.':
    '역할을 만들었습니다. 준비되면 멤버에게 할당하세요.',
  'Could not save role.': '역할을 저장하지 못했습니다.',
  'Edit {name} · version {version}': '{name} 편집 · 버전 {version}',
  'Create custom role': '사용자 지정 역할 만들기',
  'Role name': '역할 이름',
  'No workspace action grants. Members with this role can still sign in and manage their own account.':
    '워크스페이스 작업 권한이 없습니다. 이 역할의 멤버도 로그인하고 자신의 계정을 관리할 수 있습니다.',
  'Backup access exposes the entire workspace, including saved data and sensitive credential records. Keep downloads private.':
    '백업 접근 권한은 저장된 데이터와 민감한 인증 정보 기록을 포함한 전체 워크스페이스를 노출합니다. 다운로드한 파일을 비공개로 보관하세요.',
  'Load testing repeatedly executes live APIs. Configured writes can change product data. Grant only to trusted operators.':
    '부하 테스트는 실제 API를 반복해서 실행합니다. 설정된 쓰기 작업으로 제품 데이터가 변경될 수 있습니다. 신뢰할 수 있는 운영자에게만 권한을 부여하세요.',
  'Save role': '역할 저장',
  'Cancel role changes': '역할 변경 취소',
  'If another owner session changes this role, refresh the members page and reopen the role before saving again.':
    '다른 소유자 세션에서 이 역할을 변경했다면 멤버 페이지를 새로 고치고 역할을 다시 연 다음 저장하세요.',
  'Custom · v{version}': '사용자 지정 · v{version}',
  'Account and own sessions only': '자신의 계정과 세션만',
  'Edit {name}': '{name} 편집',
  'Delete role {name}? This cannot be undone. Roles assigned to members cannot be deleted.':
    '{name} 역할을 삭제할까요? 이 작업은 되돌릴 수 없습니다. 멤버에게 할당된 역할은 삭제할 수 없습니다.',
  'Role deleted.': '역할을 삭제했습니다.',
  'Could not delete role.': '역할을 삭제하지 못했습니다.',
  'Delete {name}': '{name} 삭제',
  'No custom roles yet. Built-in owner, editor, and viewer roles stay available.':
    '아직 사용자 지정 역할이 없습니다. 기본 소유자, 편집자, 뷰어 역할은 계속 사용할 수 있습니다.',
  'Read APIs': 'API 읽기',
  'Edit APIs': 'API 편집',
  'Test drafts': '초안 테스트',
  'Publish and roll back': '게시 및 롤백',
  'Read data sources': '데이터 소스 읽기',
  'Manage data sources': '데이터 소스 관리',
  'Read database copies': '데이터베이스 복사본 읽기',
  'Manage database copies': '데이터베이스 복사본 관리',
  'Read product login connections': '제품 로그인 연결 읽기',
  'Manage product login connections': '제품 로그인 연결 관리',
  'Manage runtime API keys': '런타임 API 키 관리',
  'Read audit history': '감사 기록 읽기',
  'Manage workspace backups': '워크스페이스 백업 관리',
  'Read migration history': '마이그레이션 기록 읽기',
  'Run load tests': '부하 테스트 실행',
  APIs: 'API',
  Databases: '데이터베이스',
  Security: '보안',
  'Read authorized API drafts, release history, OpenAPI documents, client examples, and generated backend source.':
    '접근이 허용된 API 초안, 릴리스 기록, OpenAPI 문서, 클라이언트 예제 및 생성된 백엔드 소스를 읽습니다.',
  'Create and save API drafts. Selected access permits editing existing shared APIs with explicit dependency use, but cannot create APIs.':
    'API 초안을 만들고 저장합니다. 선택된 API 접근 권한으로는 명시적인 의존 리소스 USE 권한이 있는 기존 공유 API를 편집할 수 있지만 API를 만들 수는 없습니다.',
  'Execute saved REST and GraphQL drafts, including their configured data and product-login steps. Selected access also requires explicit dependency use.':
    '설정된 데이터 및 제품 로그인 단계를 포함하여 저장된 REST와 GraphQL 초안을 실행합니다. 선택된 API 접근 권한에는 명시적인 의존 리소스 USE 권한도 필요합니다.',
  'Change live API behavior by publishing drafts or rolling back releases.':
    '초안을 게시하거나 릴리스를 롤백하여 실제 API의 동작을 변경합니다.',
  'Read source metadata and saved rows.':
    '소스 메타데이터와 저장된 행을 읽습니다.',
  'Import, replace, refresh, and delete sources. Replacing data changes what published APIs read.':
    '소스를 가져오고 교체하고 새로 고치고 삭제합니다. 데이터를 교체하면 게시된 API가 읽는 내용이 변경됩니다.',
  'Read uploaded SQLite copy metadata and selected rows. Generated APIs may expose their configured data.':
    '업로드된 SQLite 복사본의 메타데이터와 선택된 행을 읽습니다. 생성된 API는 설정된 데이터를 노출할 수 있습니다.',
  'Upload, check, and delete immutable SQLite copies. Workspace backups include all uploaded data.':
    '변경할 수 없는 SQLite 복사본을 업로드하고 확인하고 삭제합니다. 워크스페이스 백업에는 업로드된 모든 데이터가 포함됩니다.',
  'Read product-login connection metadata without provider secrets.':
    '공급자 비밀 정보를 제외한 제품 로그인 연결 메타데이터를 읽습니다.',
  'Create, update, and delete server-held provider credentials. Changes affect live product login.':
    '서버에 보관된 공급자 인증 정보를 만들고 업데이트하고 삭제합니다. 변경 사항은 실제 제품 로그인에 영향을 줍니다.',
  'Issue, list, replace, and revoke runtime keys. Selected access manages issuer-bound keys for shared APIs; issuance and replacement require dependency use and preserve release pins.':
    '런타임 키를 발급하고 조회하고 교체하고 폐기합니다. 선택된 API 접근 권한으로는 공유 API의 발급자에 연결된 키를 관리합니다. 발급과 교체에는 의존 리소스 USE 권한이 필요하며 릴리스 고정 정보가 유지됩니다.',
  'Read workspace activity and security events.':
    '워크스페이스 활동과 보안 이벤트를 읽습니다.',
  'Create, list, and download complete workspace backups containing saved data and sensitive credential records.':
    '저장된 데이터와 민감한 인증 정보 기록을 포함한 전체 워크스페이스 백업을 만들고 조회하고 다운로드합니다.',
  'Read the control database migration history.':
    '관리 데이터베이스의 마이그레이션 기록을 읽습니다.',
  'List published targets and load-test history; start and cancel bounded local runs. Runs execute published APIs and may cause their configured writes.':
    '게시된 대상과 부하 테스트 기록을 조회하고 제한된 로컬 실행을 시작하거나 취소합니다. 실행 시 게시된 API가 호출되며 설정된 쓰기 작업이 발생할 수 있습니다.',
  'Update available': '새 버전 사용 가능',
  'No newer release found': '더 새로운 릴리스가 없습니다',
  'No matching releases found': '설정에 맞는 릴리스가 없습니다',
  'Release check failed': '릴리스 확인 실패',
  'Owner access required to manage Besh updates.':
    'Besh 업데이트를 관리하려면 소유자 권한이 필요합니다.',
  'Could not load update information.': '업데이트 정보를 불러오지 못했습니다.',
  'YOUR BESH INSTALLATION': '설치된 BESH',
  'Besh updates': 'Besh 업데이트',
  'Check public GitHub releases when you are ready.':
    '준비되면 GitHub의 공개 릴리스를 확인하세요.',
  'Discard unsaved update settings and refresh?':
    '저장하지 않은 업데이트 설정을 버리고 새로 고칠까요?',
  'Refresh update settings': '업데이트 설정 새로 고침',
  'Loading update settings…': '업데이트 설정을 불러오는 중…',
  'Update settings saved. Check releases to get a fresh result.':
    '업데이트 설정을 저장했습니다. 최신 결과를 보려면 릴리스를 확인하세요.',
  'Release settings': '릴리스 설정',
  'GitHub repository': 'GitHub 저장소',
  'Use a public repository URL. Private repositories and access tokens are not supported.':
    '공개 저장소 URL을 사용하세요. 비공개 저장소와 접근 토큰은 지원하지 않습니다.',
  'Include preview releases': '미리 보기 릴리스 포함',
  'Show alpha, beta and other prereleases alongside stable versions.':
    '안정 버전과 함께 alpha, beta 및 기타 사전 릴리스를 표시합니다.',
  'Save update settings': '업데이트 설정 저장',
  'Save your changes before checking releases.':
    '릴리스를 확인하기 전에 변경 사항을 저장하세요.',
  'Release status': '릴리스 상태',
  'Installed {version}': '설치된 버전: {version}',
  'No release check yet': '아직 릴리스를 확인하지 않았습니다',
  'Last checked {date}': '마지막 확인: {date}',
  'Preview release': '미리 보기 릴리스',
  'View GitHub release': 'GitHub 릴리스 보기',
  'A check runs only when you choose it. Opening this page uses saved information.':
    '직접 선택할 때만 확인합니다. 이 페이지를 열면 저장된 정보를 사용합니다.',
  'Release check finished. Review the result below.':
    '릴리스 확인을 마쳤습니다. 아래 결과를 검토하세요.',
  'Check releases': '릴리스 확인',
  'One check per minute. Checks inspect the first 20 published GitHub releases.':
    '1분에 한 번 확인할 수 있습니다. GitHub에 게시된 처음 20개 릴리스를 확인합니다.',
  'This page reports versions. It does not install updates or verify release compatibility. Review release notes and back up data before upgrading.':
    '이 페이지는 버전 정보를 알려줍니다. 업데이트를 설치하거나 릴리스 호환성을 검증하지 않습니다. 업그레이드 전에 릴리스 노트를 검토하고 데이터를 백업하세요.',
  'Only the owner can manage Besh release settings and update notices.':
    '소유자만 Besh 릴리스 설정과 업데이트 알림을 관리할 수 있습니다.',
  'YOUR WORKSPACE ACCESS': '내 작업 공간 접근',
  'Manage your email sign-in and active browser sessions.':
    '이메일 로그인 정보와 활성 브라우저 세션을 관리하세요.',
  'Loading your account…': '계정을 불러오는 중…',
  'Sign-in details saved. Other browser sessions were revoked.':
    '로그인 정보를 저장했습니다. 다른 브라우저 세션은 해제되었습니다.',
  'Could not save sign-in details.': '로그인 정보를 저장하지 못했습니다.',
  'Optional. Your workspace key still works. Saving new details signs out your other browser sessions.':
    '선택 사항입니다. 작업 공간 키는 계속 사용할 수 있습니다. 새 정보를 저장하면 다른 브라우저 세션에서 로그아웃됩니다.',
  'Account email': '계정 이메일',
  'Use 12 to 128 characters.': '12~128자를 사용하세요.',
  'Confirm your identity': '본인 확인',
  'Current password': '현재 비밀번호',
  'Your workspace key': '내 작업 공간 키',
  'Save sign-in details': '로그인 정보 저장',
  'Active sessions': '활성 세션',
  'Owners can revoke sessions across this workspace.':
    '소유자는 이 작업 공간의 세션을 해제할 수 있습니다.',
  'Only your own active sessions appear here.': '내 활성 세션만 표시됩니다.',
  'Session expires {date}.': '세션 만료: {date}.',
  'Refresh sessions': '세션 새로 고침',
  Member: '멤버',
  Device: '기기',
  'Last active': '최근 활동',
  Expires: '만료',
  Access: '접근',
  'This device': '이 기기',
  'Other browser session': '다른 브라우저 세션',
  'Revoke session for {name} on this device': '이 기기의 {name} 세션 해제',
  'Revoke session for {name}': '{name} 세션 해제',
  'Revoke this session and sign out?': '이 세션을 해제하고 로그아웃할까요?',
  'Revoke this browser session for {name}?':
    '{name}의 이 브라우저 세션을 해제할까요?',
  'This session was revoked. Sign in again.':
    '이 세션이 해제되었습니다. 다시 로그인하세요.',
  'Browser session revoked.': '브라우저 세션을 해제했습니다.',
  Revoke: '해제',
  'No active sessions.': '활성 세션이 없습니다.',
  Language: '언어',
  'Use device language': '기기 언어 사용',
  Appearance: '화면 스타일',
  Light: '밝게',
  Dark: '어둡게',
  System: '시스템 설정',
  'API Studio': 'API 스튜디오',
  'Data sources': '데이터 소스',
  'Database connections': '데이터베이스 연결',
  'Product login': '제품 로그인',
  'Load testing': '부하 테스트',
  'Audit trail': '감사 기록',
  Members: '멤버',
  'Tenant protection': '테넌트 보호',
  'API keys': 'API 키',
  'Account & sessions': '계정 및 세션',
  'Data & backups': '데이터 및 백업',
  Updates: '업데이트',
  'What’s next': '다음 단계',
  Workspace: '작업 공간',
  'Local workspace': '로컬 작업 공간',
  WORKSPACE: '작업 공간',
  'YOUR APIS': '내 API',
  'New API': '새 API',
  'Workspace navigation': '작업 공간 탐색',
  'Sign out': '로그아웃',
  'Working…': '처리 중…',
  'Opening your workspace…': '작업 공간 여는 중…',
  'Opening invitation…': '초대 여는 중…',
  'Opening studio…': '스튜디오 여는 중…',
  'Try again': '다시 시도',
  'Help & roadmap': '도움말 및 로드맵',
  'Drafts stay separate from published APIs':
    '초안은 게시된 API와 별도로 유지됩니다',
  'No APIs shared': '공유된 API 없음',
  'Permission required': '권한 필요',
  'Owner access required': '소유자 권한 필요',
  'Editor access required': '편집자 권한 필요',
  Save: '저장',
  Cancel: '취소',
  Close: '닫기',
  Refresh: '새로고침',
  Search: '검색',
  'API tools': 'API 도구',
  'Review details': '세부 정보 검토',
  'Besh home': 'Besh 홈',
  'A SPACE FOR YOUR NEXT IDEA': '다음 아이디어를 위한 공간',
  'Your next API.': '당신의 다음 API.',
  'Clearly connected.': '명확하게 연결하세요.',
  'Turn an idea into an endpoint. Build visually, test your flow, and publish when you’re ready.':
    '아이디어를 API 엔드포인트로 만드세요. 화면에서 구성하고 흐름을 테스트한 뒤 준비되면 게시하세요.',
  'Start with a simple request.': '간단한 요청으로 시작하세요.',
  'Ask for exactly what you need.': '필요한 데이터만 요청하세요.',
  'JSON response': 'JSON 응답',
  Request: '요청',
  Response: '응답',
  'Your workspace. Your APIs. Private by default.':
    '내 작업 공간, 내 API. 기본 설정은 비공개입니다.',
  '02 / SAVE YOUR KEY': '02 / 키 보관',
  '01 / MAKE IT YOURS': '01 / 내 공간 설정',
  'WELCOME BACK': '다시 오신 것을 환영합니다',
  'Your workspace is ready.': '작업 공간이 준비되었습니다.',
  'A little setup. A lot of possibility.': '간단한 설정, 다양한 가능성.',
  'Open your workspace.': '작업 공간을 여세요.',
  'Keep this owner key safe. It is shown once.':
    '소유자 키를 안전하게 보관하세요. 한 번만 표시됩니다.',
  'Choose a name for your workspace. We’ll create an owner key so you can get started.':
    '작업 공간의 이름을 정하세요. 시작할 수 있도록 소유자 키를 생성합니다.',
  'Sign in with email and password, or your owner or member key. Configure email sign-in in Account & sessions.':
    '이메일과 비밀번호 또는 소유자·멤버 키로 로그인하세요. 이메일 로그인은 계정 및 세션에서 설정할 수 있습니다.',
  'Sign-in method': '로그인 방법',
  'Workspace key': '작업 공간 키',
  'Email & password': '이메일 및 비밀번호',
  'Workspace name': '작업 공간 이름',
  'Setup key': '설정 키',
  'Open the setup link printed in your server terminal.':
    '서버 터미널에 표시된 설정 링크를 여세요.',
  'Visual API Studio': '시각적 API 스튜디오',
  'Separate drafts and releases': '초안과 릴리스 분리',
  'Private workspace': '비공개 작업 공간',
  Email: '이메일',
  Password: '비밀번호',
  'Your owner key': '내 소유자 키',
  'Workspace token': '작업 공간 토큰',
  'Copy owner key': '소유자 키 복사',
  'I saved my owner key': '소유자 키를 보관했습니다',
  'Your key creates a private browser session. The key is discarded after sign-in.':
    '키로 비공개 브라우저 세션을 만듭니다. 로그인 후 키는 지워집니다.',
  'Enter studio': '스튜디오 들어가기',
  'Create workspace': '작업 공간 만들기',
  'Open workspace': '작업 공간 열기',
  'A small start. Something worth building.':
    '작은 시작으로 가치 있는 것을 만드세요.',
  'Workspace created. Save your owner key.':
    '작업 공간을 만들었습니다. 소유자 키를 보관하세요.',
  'Owner key copied.': '소유자 키를 복사했습니다.',
  'YOUR WORKSPACE INVITATION': '작업 공간 초대',
  'Your workspace invite.': '작업 공간 초대입니다.',
  'Set up email sign-in for your existing member. Your role and API access do not change.':
    '기존 멤버의 이메일 로그인을 설정하세요. 역할과 API 접근 권한은 바뀌지 않습니다.',
  'Accept invitation': '초대 수락',
  'Password set': '비밀번호 설정 완료',
  'Email sign-in is ready for {email}. You are not signed in yet.':
    '{email}의 이메일 로그인 설정이 완료되었습니다. 아직 로그인하지 않았습니다.',
  'Sign in': '로그인',
  'Reading invitation…': '초대 읽는 중…',
  'Check invitation': '초대 확인',
  'Selected APIs': '선택한 API',
  'All APIs': '모든 API',
  'Expires {date}.': '만료: {date}.',
  'Current sign-in': '현재 로그인',
  'Checking current sign-in…': '현재 로그인 확인 중…',
  'You are signed in as {name}. Sign out explicitly before setting this member’s password.':
    '현재 {name}(으)로 로그인되어 있습니다. 이 멤버의 비밀번호를 설정하기 전에 로그아웃하세요.',
  'Sign out to accept invitation': '로그아웃하고 초대 수락',
  'Return to workspace': '작업 공간으로 돌아가기',
  'No workspace sign-in is active.': '로그인된 작업 공간이 없습니다.',
  'Check current sign-in': '현재 로그인 확인',
  'New password': '새 비밀번호',
  'Invitation password': '새 비밀번호',
  'Confirm password': '비밀번호 확인',
  'Confirm invitation password': '비밀번호 확인',
  'Use 12 to 128 characters. Your existing workspace key still works.':
    '12~128자를 사용하세요. 기존 작업 공간 키도 계속 사용할 수 있습니다.',
  'Set password': '비밀번호 설정',
  'Leave invitation and sign in': '초대를 닫고 로그인',
  'Discard unsaved draft changes and sign out to accept this invitation?':
    '저장하지 않은 초안 변경을 버리고 로그아웃하여 초대를 수락할까요?',
  'Passwords must match.': '비밀번호가 일치해야 합니다.',
  'Could not read invitation.': '초대를 읽지 못했습니다.',
  'Could not read your current sign-in.': '현재 로그인 상태를 읽지 못했습니다.',
  'Current sign-in unknown. Check it before setting a password.':
    '현재 로그인 상태를 알 수 없습니다. 비밀번호 설정 전에 확인하세요.',
  'Could not confirm sign-out. Check current sign-in before continuing; no automatic retry was made.':
    '로그아웃 완료를 확인하지 못했습니다. 계속하기 전에 로그인 상태를 확인하세요. 자동 재시도는 하지 않았습니다.',
  'Could not confirm password setup.':
    '비밀번호 설정 완료를 확인하지 못했습니다.',
  'No automatic retry was made. Try ordinary email sign-in if it may have succeeded, or ask the owner to refresh invitations and review a new link.':
    '자동 재시도는 하지 않았습니다. 성공했을 수 있다면 일반 이메일 로그인을 시도하거나 소유자에게 초대를 새로고침하고 새 링크를 검토해 달라고 요청하세요.',
  'Sign-in invitation': '로그인 초대',
  Invitations: '초대',
  'Set up email sign-in for an existing key-only member. Their role, API access and tenant assignment stay unchanged. Existing accounts cannot be reset with an invitation.':
    '키로만 로그인하는 기존 멤버의 이메일 로그인을 설정합니다. 역할, API 접근 권한, 테넌트 할당은 바뀌지 않습니다. 초대로 기존 계정을 초기화할 수 없습니다.',
  'Refresh invitations': '초대 새로고침',
  'Loading invitations…': '초대 불러오는 중…',
  'Current invitations unknown. Refresh needed.':
    '현재 초대를 알 수 없습니다. 새로고침이 필요합니다.',
  'Existing member': '기존 멤버',
  'Invitation member': '기존 멤버',
  'Invitation email': '초대 이메일',
  'Expires in 24 hours. Besh does not send email.':
    '24시간 후 만료됩니다. Besh는 이메일을 보내지 않습니다.',
  'Anyone holding the link can set this member’s password. It does not prove email ownership. Share it privately. Creating another link invalidates this member’s earlier invitation; their workspace key still works.':
    '링크를 가진 사람은 누구나 이 멤버의 비밀번호를 설정할 수 있습니다. 이메일 소유권을 증명하지는 않습니다. 비공개로 공유하세요. 새 링크를 만들면 이전 초대는 무효가 되지만 작업 공간 키는 계속 작동합니다.',
  'Create invitation link': '초대 링크 만들기',
  'Save this invitation link': '이 초대 링크 보관',
  'Link status unconfirmed. Refresh invitations before sharing it.':
    '링크 상태가 확인되지 않았습니다. 공유하기 전에 초대를 새로고침하세요.',
  'Current pending invitation.': '현재 수락 대기 중인 초대입니다.',
  'This invitation is no longer active. Its link cannot set a password.':
    '이 초대는 더 이상 유효하지 않습니다. 링크로 비밀번호를 설정할 수 없습니다.',
  'Invitation link': '초대 링크',
  'Copy invitation link': '초대 링크 복사',
  'I saved the link': '링크를 보관했습니다',
  'Pending invitations': '수락 대기 중인 초대',
  'Refresh to read current pending invitations.':
    '현재 대기 중인 초대를 읽으려면 새로고침하세요.',
  'Revoke invitation': '초대 취소',
  'No pending invitations.': '대기 중인 초대가 없습니다.',
  'Close invitations': '초대 닫기',
  'Could not read invitations.': '초대 목록을 읽지 못했습니다.',
  'Refresh invitations before changing a link.':
    '링크를 변경하기 전에 초대를 새로고침하세요.',
  'Refresh invitations before trying again.':
    '다시 시도하기 전에 초대를 새로고침하세요.',
  'Could not confirm whether the invitation was created. Refresh invitations to review current links before reissuing or revoking.':
    '초대 생성 여부를 확인하지 못했습니다. 재발급하거나 취소하기 전에 초대를 새로고침하여 현재 링크를 검토하세요.',
  'Could not confirm whether the invitation was revoked. Refresh invitations before changing another link.':
    '초대 취소 여부를 확인하지 못했습니다. 다른 링크를 변경하기 전에 초대를 새로고침하세요.',
  'Invitation created. Copy the link; it is shown once.':
    '초대를 만들었습니다. 링크를 복사하세요. 한 번만 표시됩니다.',
  'Invitation revoked. That link can no longer set a password.':
    '초대를 취소했습니다. 이 링크로는 더 이상 비밀번호를 설정할 수 없습니다.',
  'Invitation link copied.': '초대 링크를 복사했습니다.',
  'Invitation unavailable': '초대를 사용할 수 없습니다',
  'Too many invitation attempts': '초대 시도 횟수가 너무 많습니다',
  'Email address unavailable': '이메일 주소를 사용할 수 없습니다',
  'Invitation state unavailable': '초대 상태를 확인할 수 없습니다',
  'Choose a member and valid email address':
    '멤버를 선택하고 유효한 이메일 주소를 입력하세요',
  'Choose an existing member without an account':
    '계정이 없는 기존 멤버를 선택하세요',
  'Pending invitation limit reached': '대기 중인 초대 수가 한도에 도달했습니다',
  'Provide an invitation token': '초대 토큰을 제공하세요',
  'Provide an invitation token and password of 12 to 128 characters':
    '초대 토큰과 12~128자 비밀번호를 제공하세요',
  'Invalid credentials': '로그인 정보가 올바르지 않습니다',
  'Too many login attempts': '로그인 시도 횟수가 너무 많습니다',
  'Enter a valid email address': '유효한 이메일 주소를 입력하세요',
  'Password must contain 12 to 128 characters':
    '비밀번호는 12~128자여야 합니다',
  'Email and password must be provided together':
    '이메일과 비밀번호를 함께 입력해야 합니다',
  'Authentication required': '로그인이 필요합니다',
  'Permission denied': '권한이 없습니다',
  'Workspace is shutting down': '작업 공간 종료 중',
  'Browser origin rejected': '브라우저 출처가 거부되었습니다',
  'Session verification required': '세션 확인이 필요합니다',
  'Your session expired. Sign in again.':
    '세션이 만료되었습니다. 다시 로그인하세요.',
  'Your session expired or was revoked. Sign in again.':
    '세션이 만료되었거나 취소되었습니다. 다시 로그인하세요.',
  'Signed out. This session was revoked.':
    '로그아웃했습니다. 이 세션은 취소되었습니다.',
  'This session has already ended. Sign in again.':
    '이미 종료된 세션입니다. 다시 로그인하세요.',
  'Workspace ready.': '작업 공간이 준비되었습니다.',
  'Connect your first idea.': '첫 아이디어를 연결하세요.',
  'Request failed': '요청 실패',
  'Could not restore session.': '세션을 복원하지 못했습니다.',
  'Invitation link unavailable. Ask the owner for a new link.':
    '초대 링크를 사용할 수 없습니다. 소유자에게 새 링크를 요청하세요.',
  'nodePicker.open': '단계 추가',
  'Add step': '단계 추가',
  'nodePicker.title': '단계 선택',
  'Choose a step': '단계 선택',
  'nodePicker.search': '단계 검색',
  'Search steps': '단계 검색',
  'nodePicker.help':
    '이 초안에 사용할 단계를 선택하세요. 추가한 뒤 필드를 설정하세요.',
  'Choose a step for this draft. Configure its fields after adding.':
    '이 초안에 사용할 단계를 선택하세요. 추가한 뒤 필드를 설정하세요.',
  'nodePicker.all': '모든 단계',
  'All steps': '모든 단계',
  'nodePicker.favorites': '즐겨찾기',
  Favorites: '즐겨찾기',
  'nodePicker.empty': '단계를 찾지 못했습니다.',
  'No steps found.': '단계를 찾지 못했습니다.',
  'nodePicker.noFavorites': '즐겨찾는 단계가 없습니다.',
  'No favorite steps yet.': '즐겨찾는 단계가 없습니다.',
  'nodePicker.favorite': '{name} 즐겨찾기 추가',
  'Favorite {name}': '{name} 즐겨찾기 추가',
  'nodePicker.unfavorite': '{name} 즐겨찾기 해제',
  'Remove {name} from favorites': '{name} 즐겨찾기 해제',
  'nodePicker.add': '{name} 추가',
  'Add {name}': '{name} 추가',
  'nodePicker.close': '단계 선택 창 닫기',
  'Close step picker': '단계 선택 창 닫기',
  'nodePicker.unavailable': '이 API에서 사용할 수 없습니다',
  'Unavailable for this API': '이 API에서 사용할 수 없습니다',
  'nodePicker.requestExists': '이 API에는 이미 요청 단계가 있습니다.',
  'This API already has a request step.':
    '이 API에는 이미 요청 단계가 있습니다.',
  'nodePicker.category.api': 'API',
  API: 'API',
  'nodePicker.category.logic': '로직',
  Logic: '로직',
  'nodePicker.category.data': '데이터',
  Data: '데이터',
  'nodePicker.category.identity': '제품 로그인',
  'nodePicker.categories': '단계 카테고리',
  'Step categories': '단계 카테고리',
  'nodePicker.results': '일치하는 단계',
  'Matching steps': '일치하는 단계',
  'nodes.request.label': 'HTTP 요청',
  'HTTP request': 'HTTP 요청',
  'nodes.request.description': 'API를 시작하고 입력을 받습니다.',
  'Start the API and receive its input.': 'API를 시작하고 입력을 받습니다.',
  'nodes.response.label': 'JSON 응답',
  'nodes.response.description': 'API 결과를 호출자에게 보냅니다.',
  'Send the API result back to its caller.': 'API 결과를 호출자에게 보냅니다.',
  'nodes.condition.label': '조건',
  Condition: '조건',
  'nodes.condition.description': '입력값을 비교하고 다음 경로를 선택합니다.',
  'Compare an input value and choose the next path.':
    '입력값을 비교하고 다음 경로를 선택합니다.',
  'nodes.data.label': '스프레드시트 행',
  'Spreadsheet rows': '스프레드시트 행',
  'nodes.data.description':
    '가져온 스프레드시트나 저장된 Google Sheet에서 선택한 필드를 읽습니다.',
  'Read chosen fields from an imported spreadsheet or saved Google Sheet.':
    '가져온 스프레드시트나 저장된 Google Sheet에서 선택한 필드를 읽습니다.',
  'nodes.database.label': 'SQLite 행',
  'SQLite rows': 'SQLite 행',
  'nodes.database.description':
    '업로드한 SQLite 복사본에서 선택한 필드를 읽습니다.',
  'Read chosen fields from an uploaded SQLite copy.':
    '업로드한 SQLite 복사본에서 선택한 필드를 읽습니다.',
  'nodes.social.label': 'GitHub 로그인',
  'GitHub login': 'GitHub 로그인',
  'nodes.social.description': '제품 API에 GitHub 로그인을 추가합니다.',
  'Add GitHub sign-in to the product API.':
    '제품 API에 GitHub 로그인을 추가합니다.',
  'nodes.wsRequest.label': '메시지 받기',
  'Receive message': '메시지 받기',
  'nodes.wsRequest.description':
    '타입이 지정된 WebSocket 메시지 하나를 받습니다.',
  'Receive one typed WebSocket message.':
    '타입이 지정된 WebSocket 메시지 하나를 받습니다.',
  'nodes.wsResponse.label': '응답 보내기',
  'Send reply': '응답 보내기',
  'nodes.wsResponse.description':
    '타입이 지정된 WebSocket 응답 하나를 보냅니다.',
  'Send one typed WebSocket reply.':
    '타입이 지정된 WebSocket 응답 하나를 보냅니다.',
  'API editing is unavailable.': 'API를 편집할 수 없습니다.',
  'This API already has 64 steps.': '이 API에는 이미 64개 단계가 있습니다.',
  'This API already has a starting step.':
    '이 API에는 이미 시작 단계가 있습니다.',
  'This step is unavailable for WebSocket request/reply.':
    '이 단계는 WebSocket 요청·응답에서 사용할 수 없습니다.',
  'This WebSocket API already has a reply step.':
    '이 WebSocket API에는 이미 응답 단계가 있습니다.',
  'WebSocket request/reply supports one data read.':
    'WebSocket 요청·응답은 데이터 읽기 한 번을 지원합니다.',
  Draft: '초안',
  'Unsaved changes': '저장하지 않은 변경 사항',
  Saved: '저장됨',
  'Save draft': '초안 저장',
  Publish: '게시',
  'API name': 'API 이름',
  'API NAME': 'API 이름',
  'API TYPE': 'API 유형',
  'API type': 'API 유형',
  METHOD: '메서드',
  'HTTP method': 'HTTP 메서드',
  'ENDPOINT PATH': '엔드포인트 경로',
  'Endpoint path': '엔드포인트 경로',
  'Test flow': '흐름 테스트',
  'Request input': '요청 입력',
  'Apply configuration': '설정 적용',
  'Remove node': '노드 삭제',
  'Advanced configuration': '고급 설정',
  'Node configuration': '노드 설정',
  'Create your first API': '첫 API 만들기',
  'Start with a spreadsheet': '스프레드시트로 시작',
  'Build a blank API': '빈 API 만들기',
  'Response status': '응답 상태',
  'Response contents': '응답 내용',
  'Response fields': '응답 필드',
  'Rows from data step': '데이터 단계의 행',
  'GitHub login result': 'GitHub 로그인 결과',
  'Input source': '입력 소스',
  'Input field': '입력 필드',
  Comparison: '비교',
  Equals: '같음',
  'Expected type': '예상 타입',
  'Expected value': '예상 값',
  Text: '텍스트',
  Number: '숫자',
  'True or false': '참 또는 거짓',
  'Empty value': '빈 값',
  'Request body': '요청 본문',
  'Query parameter': '쿼리 매개변수',
  'Path parameter': '경로 매개변수',
  'From request body': '요청 본문에서',
  'From query parameter': '쿼리 매개변수에서',
  'From path parameter': '경로 매개변수에서',
  'Nested data (preserved)': '중첩 데이터(유지)',
  True: '참',
  False: '거짓',
  'Path parameters': '경로 매개변수',
  'Query parameters': '쿼리 매개변수',
  'Request body fields': '요청 본문 필드',
  'Add query parameter': '쿼리 매개변수 추가',
  'Add body field': '본문 필드 추가',
  'Add response field': '응답 필드 추가',
  '{prefix} name {number}': '{prefix} 이름 {number}',
  '{prefix} type {number}': '{prefix} 타입 {number}',
  '{prefix} value {number}': '{prefix} 값 {number}',
  'Remove {prefix} field {number}': '{prefix} 필드 {number} 삭제',
  'Path parameter {name}': '경로 매개변수 {name}',
  'Value for :{name}': ':{name} 값',
  Field: '필드',
  Body: '본문',
  Query: '쿼리',
  'Finish opening your workspace or the current action, then reopen the invitation link. Your draft was kept.':
    '작업 공간 열기나 현재 작업이 끝난 뒤 초대 링크를 다시 여세요. 초안은 유지되었습니다.',
  'Leave the editor to review this invitation? Your unsaved draft will be kept until you return or confirm sign-out.':
    '편집기를 나가 이 초대를 검토할까요? 돌아오거나 로그아웃을 확인할 때까지 저장하지 않은 초안이 유지됩니다.',
  'Discard unsaved draft changes and open sign-in?':
    '저장하지 않은 초안 변경을 버리고 로그인 화면을 열까요?',
  'Workspace already configured': '작업 공간이 이미 설정되었습니다',
  'Open the setup link from your server terminal':
    '서버 터미널의 설정 링크를 여세요',
  'HTTPS browser origin required': '브라우저 출처에 HTTPS가 필요합니다',
  'Invitation revocation takes no fields':
    '초대 취소에는 필드를 사용할 수 없습니다',
  'Request failed ({status}).': '요청 실패 ({status}).',
  'Invalid request': '요청이 올바르지 않습니다',
  'Invalid request body': '요청 본문이 올바르지 않습니다',
  'REST API': 'REST API',
  'GraphQL API': 'GraphQL API',
  'Remove field {number}': '필드 {number} 삭제',
  'NODE SETTINGS': '노드 설정',
  'BUILD SOMETHING USEFUL': '유용한 것을 만드세요',
  'Connect the dots. Let your API do the work.':
    '단계를 연결하고 API가 작업을 처리하게 하세요.',
  'API key protected': 'API 키로 보호됨',
  'Published endpoint URL': '게시된 엔드포인트 URL',
  'Flow canvas': '흐름 캔버스',
  'New draft': '새 초안',
  'Try it out': '직접 테스트',
  'WAITING FOR A RUN': '실행 대기 중',
  'Use this API': '이 API 사용',
  'Generated backend': '생성된 백엔드',
  'Your API starts here': 'API가 여기서 시작됩니다',
  'Choose a path': '경로 선택',
  'Send something back': '응답 보내기',
  'Read selected columns': '선택한 열 읽기',
  'Read an uploaded copy': '업로드한 복사본 읽기',
  'Resolve a product identity': '제품 사용자 식별',
  'Data source': '데이터 소스',
  'Maximum rows': '최대 행 수',
  'Filter rows': '행 필터링',
  'Match one column': '열 하나와 일치',
  'Match column': '일치시킬 열',
  'Match value type': '일치 값 타입',
  'Fixed text': '고정 텍스트',
  'Fixed number': '고정 숫자',
  'Match value': '일치 값',
  'Include {name}': '{name} 포함',
  'API field: {name}': 'API 필드: {name}',
  'Small steps. Powerful APIs.': '작은 단계로 강력한 API를.',
  'Build a flow you can understand, test, and trust.':
    '이해하고 테스트하며 신뢰할 수 있는 흐름을 만드세요.',
  owner: '소유자',
  editor: '편집자',
  viewer: '뷰어',
  'Unknown role': '알 수 없는 역할',
  'Custom role': '사용자 지정 역할',
  'Loading saved source details…': '저장된 데이터 소스 정보를 불러오는 중…',
  'No saved sources are available. Import a spreadsheet in Data sources, then return to this step.':
    '저장된 데이터 소스가 없습니다. 데이터 소스에서 스프레드시트를 가져온 다음 이 단계로 돌아오세요.',
  'No allowed sources are available. Ask the owner to review source USE for your selected APIs.':
    '허용된 데이터 소스가 없습니다. 소유자에게 공유된 API의 데이터 소스 USE 권한을 확인해 달라고 요청하세요.',
  'Choose a saved source to configure this step.':
    '저장된 데이터 소스를 선택하여 이 단계를 설정하세요.',
  'Source details could not be loaded. Check the error above.':
    '데이터 소스 정보를 불러오지 못했습니다. 위의 오류를 확인하세요.',
  'Source access is required. Ask the owner to review your permissions and source USE.':
    '데이터 소스 접근 권한이 필요합니다. 소유자에게 권한과 데이터 소스 USE 권한을 확인해 달라고 요청하세요.',
  'No sources are available to this account. Ask the owner to provide a source.':
    '이 계정에서 사용할 수 있는 데이터 소스가 없습니다. 소유자에게 데이터 소스를 제공해 달라고 요청하세요.',
  'Start with your spreadsheet, or build a blank API using the request and response below. Opening either path does not save or publish an API. You choose when to create or save its draft.':
    '스프레드시트로 시작하거나 아래의 요청과 응답으로 빈 API를 만드세요. 어느 경로를 열어도 API가 저장되거나 게시되지 않습니다. 초안을 만들거나 저장할 시점은 직접 선택합니다.',
  'Your next idea starts here.': '다음 아이디어는 여기서 시작됩니다.',
  'Create your first API.': '첫 API를 만드세요.',
  'Live · v{version}': '게시됨 · v{version}',
  'Saved · revision {revision}': '저장됨 · 리비전 {revision}',
  '{nodes} nodes · {connections} connections':
    '노드 {nodes}개 · 연결 {connections}개',
  'Use /v1/customers/:id for a versioned route with a path parameter. Each :name occupies a whole route segment.':
    '버전과 경로 매개변수가 있는 경로에는 /v1/customers/:id를 사용하세요. 각 :name은 경로의 한 구간 전체를 차지해야 합니다.',
  'Owner and member keys manage drafts. Create an API key in API keys to call a published endpoint.':
    '소유자 키와 멤버 키는 초안을 관리합니다. 게시된 엔드포인트를 호출하려면 API 키 페이지에서 API 키를 만드세요.',
  'REQUEST DETAILS': '요청 세부 정보',
  '// Save your draft, then run a test.\n// Your response will appear here.':
    '// 초안을 저장한 다음 테스트를 실행하세요.\n// 응답이 여기에 표시됩니다.',
  'Discard unsaved draft changes?': '저장하지 않은 초안 변경 사항을 버릴까요?',
  'Use an exact path, such as /v1/customers. GraphQL arguments carry input values.':
    '/v1/customers와 같은 정확한 경로를 사용하세요. 입력 값은 GraphQL 인수로 전달합니다.',
  'GRAPHQL OPERATION': 'GRAPHQL 작업',
  'Use an exact path, such as /v1/messages. WebSocket messages carry input values; named path parameters are not supported.':
    '/v1/messages와 같은 정확한 경로를 사용하세요. 입력 값은 WebSocket 메시지로 전달하며 이름이 있는 경로 매개변수는 지원하지 않습니다.',
}

export default messages
