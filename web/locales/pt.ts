const messages: Record<string, string> = {
  'FROM SPREADSHEET TO API': 'DA PLANILHA À API',
  'Bring your data. Preview its columns. Build an API without writing JSON.':
    'Traga seus dados, confira as colunas e crie uma API sem escrever JSON.',
  'Refresh list': 'Atualizar lista',
  'Import a spreadsheet': 'Importar uma planilha',
  'Check your data': 'Conferir os dados',
  'Choose API fields': 'Escolher campos da API',
  'Add a data source': 'Adicionar uma fonte de dados',
  'Import method': 'Método de importação',
  'Spreadsheet file': 'Arquivo de planilha',
  'Public Google Sheet': 'Planilha Google pública',
  'Source name': 'Nome da fonte',
  Products: 'Produtos',
  'Import spreadsheet': 'Importar planilha',
  'CSV or Excel (.xlsx), up to 2 MB. Put column names in the first row. Imports save a snapshot of your data.':
    'CSV ou Excel (.xlsx), até 2 MB. Coloque os nomes das colunas na primeira linha. A importação salva uma cópia dos dados daquele momento.',
  'No data sources yet.': 'Ainda não há fontes de dados.',
  'Import a spreadsheet to see your data here.':
    'Importe uma planilha para ver seus dados aqui.',
  'Spreadsheet imported. Check your data before creating an API.':
    'Planilha importada. Confira os dados antes de criar uma API.',
  'Saved data source': 'Fonte de dados salva',
  '{source} · {count} rows': '{source} · {count} linhas',
  '{count} rows': '{count} linhas',
  'Empty cells allowed': 'Células vazias permitidas',
  Empty: 'Vazio',
  'Your team': 'Sua equipe',
  'WORKSPACE CONTROL': 'CONTROLE DO ESPAÇO DE TRABALHO',
  'Member keys manage the workspace. Use API keys for published endpoint callers.':
    'As chaves de membro gerenciam o espaço de trabalho. Use chaves de API para chamar endpoints publicados.',
  'Loading workspace records…':
    'Carregando os registros do espaço de trabalho…',
  'Only the owner can manage members and roles.':
    'Somente o proprietário pode gerenciar membros e funções.',
  'Refresh Members and review an active tenant before creating this member.':
    'Atualize a página de membros e revise um tenant ativo antes de criar este membro.',
  'Create {name} with assigned tenant {tenant}? Protected API actions derive this identity. API permissions and dependency USE remain separate. This assignment and member credential are created together.':
    'Criar {name} com o tenant {tenant} atribuído? As ações de API protegidas usam esta identidade. As permissões de API e o USE de dependências continuam separados. Esta atribuição e a credencial do membro são criadas juntas.',
  'Member created. Save their token; it is shown once.':
    'Membro criado. Salve o token; ele é exibido apenas uma vez.',
  Name: 'Nome',
  'Member name': 'Nome do membro',
  Role: 'Função',
  'Member role': 'Função do membro',
  'Member email (optional)': 'Email do membro (opcional)',
  'Member password': 'Senha do membro',
  '12 to 128 characters. Leave email blank for key-only access.':
    'De 12 a 128 caracteres. Deixe o email em branco para acesso somente por chave.',
  'New member API access': 'Acesso do novo membro às APIs',
  'New member tenant': 'Tenant do novo membro',
  'No tenant assigned': 'Nenhum tenant atribuído',
  'Optional initial assignment. Review before adding the member; no separate credential creation and reassignment occurs.':
    'A atribuição inicial é opcional. Revise antes de adicionar o membro; a credencial não é criada separadamente para depois ser reatribuída.',
  'Add member': 'Adicionar membro',
  'Save this member token': 'Salve este token de membro',
  'New member token': 'Novo token de membro',
  'Member token copied.': 'Token de membro copiado.',
  Copy: 'Copiar',
  'I saved it': 'Já salvei',
  'Opening invitations…': 'Abrindo convites…',
  'API access': 'Acesso às APIs',
  'Tenant identity': 'Identidade do tenant',
  'Invite sign-in': 'Convidar para entrar',
  'Bootstrap owner': 'Proprietário da configuração inicial',
  'Revoke access for {name}?': 'Revogar o acesso de {name}?',
  'Member access revoked.': 'Acesso do membro revogado.',
  'Selected APIs · {count}': 'APIs selecionadas · {count}',
  'Manage APIs for {name}': 'Gerenciar APIs de {name}',
  'Owner access cannot be restricted.':
    'O acesso do proprietário não pode ser restringido.',
  'Owner reviews a tenant for each protected action.':
    'O proprietário revisa um tenant para cada ação protegida.',
  'Assigned tenant': 'Tenant atribuído',
  'Manage tenant for {name}': 'Gerenciar tenant de {name}',
  'Viewer · read APIs': 'Visualizador · ler APIs',
  'Editor · build and test': 'Editor · criar e testar',
  '{name} · custom role': '{name} · função personalizada',
  'Role for {name}': 'Função de {name}',
  "Change {name}'s role from {current} to {next}? This ends their active browser sessions. Their member key immediately uses the new permissions.":
    'Alterar a função de {name} de {current} para {next}? Isso encerra as sessões ativas do navegador desse membro. A chave do membro passa a usar as novas permissões imediatamente.',
  'Member role updated. Their browser sessions were ended.':
    'Função do membro atualizada. As sessões do navegador desse membro foram encerradas.',
  'Could not update member role.':
    'Não foi possível atualizar a função do membro.',
  'Change role': 'Alterar função',
  'Selected APIs only': 'Somente APIs selecionadas',
  'Selected sharing limits API scope. Use Viewer or a custom role with only API, runtime-key and load-test actions. Actions still require separate role grants. It grants no API creation or global resource management.':
    'O compartilhamento selecionado limita o escopo das APIs. Use Visualizador ou uma função personalizada apenas com ações de API, chaves de runtime e testes de carga. As ações ainda exigem permissões separadas da função. Isso não permite criar APIs nem gerenciar recursos de todo o espaço de trabalho.',
  'This role has actions beyond Read APIs and selected API operations. Choose an eligible custom role or Viewer, or explicitly select All APIs before continuing.':
    'Esta função possui ações além de Ler APIs e operações de APIs selecionadas. Escolha uma função personalizada elegível ou Visualizador, ou selecione explicitamente Todas as APIs antes de continuar.',
  'Choose APIs to share': 'Escolha APIs para compartilhar',
  'Share {name}': 'Compartilhar {name}',
  '{count} APIs selected.': '{count} APIs selecionadas.',
  'No APIs selected. This member can sign in, but sees no APIs.':
    'Nenhuma API selecionada. Este membro pode entrar, mas não verá nenhuma API.',
  'Dependencies these APIs may use': 'Dependências que estas APIs podem usar',
  'USE permits these selected APIs to read chosen dependency data or trigger product login when the role allows testing, publishing or callers. It can expose stored data through the API. It grants no dependency preview or management. Row, column and tenant authorization remain separate; selecting APIs or dependencies does not provide them.':
    'USE permite que estas APIs selecionadas leiam os dados das dependências escolhidas ou iniciem o login do produto quando a função permite testes, publicação ou chamadas. Isso pode expor dados salvos pela API. Não permite visualizar nem gerenciar dependências. A autorização de linhas, colunas e tenants continua separada; selecionar APIs ou dependências não concede essas autorizações.',
  'Use spreadsheet sources': 'Usar fontes de planilhas',
  'Use SQLite copies': 'Usar cópias SQLite',
  'Use product login connections': 'Usar conexões de login do produto',
  'Use spreadsheet {name}': 'Usar planilha {name}',
  'Use SQLite copy {name}': 'Usar cópia SQLite {name}',
  'Use product login {name}': 'Usar login do produto {name}',
  'Structure only · version {version}': 'Somente estrutura · versão {version}',
  'No saved dependencies in this group.':
    'Não há dependências salvas neste grupo.',
  '{count} dependencies allowed for USE.':
    '{count} dependências permitidas para USE.',
  'All current and future APIs. Actions still follow the assigned role.':
    'Todas as APIs atuais e futuras. As ações continuam seguindo a função atribuída.',
  'Custom roles': 'Funções personalizadas',
  'New role': 'Nova função',
  'Choose actions for this local workspace. Every member can manage their own account and sessions. Member and role administration stays with the owner.':
    'Escolha as ações permitidas neste espaço de trabalho local. Todos os membros podem gerenciar a própria conta e as próprias sessões. A administração de membros e funções cabe apenas ao proprietário.',
  'Actions are separate: editing, testing, and publication each need their own grant. Reading related APIs or connections is needed to choose them in forms.':
    'As ações são separadas: editar, testar e publicar exigem permissões próprias. É preciso ter permissão de leitura das APIs ou conexões relacionadas para escolhê-las nos formulários.',
  'Loading permission choices…': 'Carregando opções de permissões…',
  'Retry permission choices': 'Tentar carregar opções de permissões novamente',
  'Save changes to {name}? Changed grants apply immediately to member keys and end affected browser sessions. Review all selected permissions before continuing.':
    'Salvar as alterações de {name}? As permissões alteradas se aplicam imediatamente às chaves dos membros e encerram as sessões de navegador afetadas. Revise todas as permissões selecionadas antes de continuar.',
  'Role updated. Changed grants end affected browser sessions.':
    'Função atualizada. As permissões alteradas encerram as sessões de navegador afetadas.',
  'Role created. Assign it to a member when ready.':
    'Função criada. Atribua-a a um membro quando estiver pronta.',
  'Could not save role.': 'Não foi possível salvar a função.',
  'Edit {name} · version {version}': 'Editar {name} · versão {version}',
  'Create custom role': 'Criar função personalizada',
  'Role name': 'Nome da função',
  'No workspace action grants. Members with this role can still sign in and manage their own account.':
    'Sem permissões para ações no espaço de trabalho. Os membros com esta função ainda podem entrar e gerenciar a própria conta.',
  'Backup access exposes the entire workspace, including saved data and sensitive credential records. Keep downloads private.':
    'O acesso aos backups expõe todo o espaço de trabalho, incluindo dados salvos e registros de credenciais sensíveis. Mantenha os arquivos baixados privados.',
  'Load testing repeatedly executes live APIs. Configured writes can change product data. Grant only to trusted operators.':
    'Os testes de carga executam repetidamente as APIs em produção. As operações de escrita configuradas podem alterar os dados do produto. Conceda acesso apenas a operadores de confiança.',
  'Save role': 'Salvar função',
  'Cancel role changes': 'Cancelar alterações da função',
  'If another owner session changes this role, refresh the members page and reopen the role before saving again.':
    'Se outra sessão do proprietário alterar esta função, atualize a página de membros e abra a função novamente antes de salvar.',
  'Custom · v{version}': 'Personalizada · v{version}',
  'Account and own sessions only': 'Apenas conta e sessões próprias',
  'Edit {name}': 'Editar {name}',
  'Delete role {name}? This cannot be undone. Roles assigned to members cannot be deleted.':
    'Excluir a função {name}? Esta ação não pode ser desfeita. Funções atribuídas a membros não podem ser excluídas.',
  'Role deleted.': 'Função excluída.',
  'Could not delete role.': 'Não foi possível excluir a função.',
  'Delete {name}': 'Excluir {name}',
  'No custom roles yet. Built-in owner, editor, and viewer roles stay available.':
    'Ainda não há funções personalizadas. As funções padrão de proprietário, editor e visualizador continuam disponíveis.',
  'Read APIs': 'Ler APIs',
  'Edit APIs': 'Editar APIs',
  'Test drafts': 'Testar rascunhos',
  'Publish and roll back': 'Publicar e reverter',
  'Read data sources': 'Ler fontes de dados',
  'Manage data sources': 'Gerenciar fontes de dados',
  'Read database copies': 'Ler cópias de bancos de dados',
  'Manage database copies': 'Gerenciar cópias de bancos de dados',
  'Read product login connections': 'Ler conexões de login do produto',
  'Manage product login connections': 'Gerenciar conexões de login do produto',
  'Manage runtime API keys': 'Gerenciar chaves de API de execução',
  'Read audit history': 'Ler histórico de auditoria',
  'Manage workspace backups': 'Gerenciar backups do espaço de trabalho',
  'Read migration history': 'Ler histórico de migrações',
  'Run load tests': 'Executar testes de carga',
  APIs: 'APIs',
  Databases: 'Bancos de dados',
  Security: 'Segurança',
  'Read authorized API drafts, release history, OpenAPI documents, client examples, and generated backend source.':
    'Ler rascunhos de APIs autorizadas, histórico de versões, documentos OpenAPI, exemplos de clientes e código-fonte do backend gerado.',
  'Create and save API drafts. Selected access permits editing existing shared APIs with explicit dependency use, but cannot create APIs.':
    'Criar e salvar rascunhos de APIs. O acesso a APIs selecionadas permite editar APIs compartilhadas existentes com permissão USE explícita para as dependências, mas não permite criar APIs.',
  'Execute saved REST and GraphQL drafts, including their configured data and product-login steps. Selected access also requires explicit dependency use.':
    'Executar rascunhos REST e GraphQL salvos, incluindo as etapas de dados e login do produto configuradas. O acesso a APIs selecionadas também exige permissão USE explícita para as dependências.',
  'Change live API behavior by publishing drafts or rolling back releases.':
    'Alterar o comportamento das APIs em produção publicando rascunhos ou revertendo versões.',
  'Read source metadata and saved rows.':
    'Ler metadados das fontes e linhas salvas.',
  'Import, replace, refresh, and delete sources. Replacing data changes what published APIs read.':
    'Importar, substituir, atualizar e excluir fontes. A substituição dos dados altera o que as APIs publicadas leem.',
  'Read uploaded SQLite copy metadata and selected rows. Generated APIs may expose their configured data.':
    'Ler metadados das cópias SQLite enviadas e linhas selecionadas. As APIs geradas podem expor os dados configurados.',
  'Upload, check, and delete immutable SQLite copies. Workspace backups include all uploaded data.':
    'Enviar, verificar e excluir cópias SQLite imutáveis. Os backups do espaço de trabalho incluem todos os dados enviados.',
  'Read product-login connection metadata without provider secrets.':
    'Ler metadados das conexões de login do produto sem os segredos do provedor.',
  'Create, update, and delete server-held provider credentials. Changes affect live product login.':
    'Criar, atualizar e excluir credenciais do provedor mantidas no servidor. As alterações afetam o login do produto em produção.',
  'Issue, list, replace, and revoke runtime keys. Selected access manages issuer-bound keys for shared APIs; issuance and replacement require dependency use and preserve release pins.':
    'Emitir, listar, substituir e revogar chaves de execução. O acesso a APIs selecionadas gerencia chaves vinculadas ao emissor para APIs compartilhadas; a emissão e a substituição exigem permissão USE para as dependências e preservam a vinculação à versão publicada.',
  'Read workspace activity and security events.':
    'Ler atividades do espaço de trabalho e eventos de segurança.',
  'Create, list, and download complete workspace backups containing saved data and sensitive credential records.':
    'Criar, listar e baixar backups completos do espaço de trabalho contendo dados salvos e registros de credenciais sensíveis.',
  'Read the control database migration history.':
    'Ler o histórico de migrações do banco de dados de controle.',
  'List published targets and load-test history; start and cancel bounded local runs. Runs execute published APIs and may cause their configured writes.':
    'Listar alvos publicados e o histórico de testes de carga; iniciar e cancelar execuções locais com limites definidos. As execuções chamam APIs publicadas e podem realizar as operações de escrita configuradas.',
  'Update available': 'Atualização disponível',
  'No newer release found': 'Nenhuma versão mais recente encontrada',
  'No matching releases found': 'Nenhuma versão corresponde às configurações',
  'Release check failed': 'Falha ao verificar versões',
  'Owner access required to manage Besh updates.':
    'É necessário acesso de proprietário para gerenciar as atualizações do Besh.',
  'Could not load update information.':
    'Não foi possível carregar as informações de atualização.',
  'YOUR BESH INSTALLATION': 'SUA INSTALAÇÃO DO BESH',
  'Besh updates': 'Atualizações do Besh',
  'Check public GitHub releases when you are ready.':
    'Verifique as versões públicas no GitHub quando estiver pronto.',
  'Discard unsaved update settings and refresh?':
    'Descartar as configurações de atualização não salvas e recarregar?',
  'Refresh update settings': 'Recarregar configurações de atualização',
  'Loading update settings…': 'Carregando configurações de atualização…',
  'Update settings saved. Check releases to get a fresh result.':
    'Configurações de atualização salvas. Verifique as versões para obter um novo resultado.',
  'Release settings': 'Configurações de versões',
  'GitHub repository': 'Repositório do GitHub',
  'Use a public repository URL. Private repositories and access tokens are not supported.':
    'Use a URL de um repositório público. Repositórios privados e tokens de acesso não são suportados.',
  'Include preview releases': 'Incluir versões de prévia',
  'Show alpha, beta and other prereleases alongside stable versions.':
    'Mostrar alpha, beta e outras pré-versões junto com as versões estáveis.',
  'Save update settings': 'Salvar configurações de atualização',
  'Save your changes before checking releases.':
    'Salve suas alterações antes de verificar as versões.',
  'Release status': 'Status da versão',
  'Installed {version}': 'Versão instalada: {version}',
  'No release check yet': 'Nenhuma verificação de versões realizada',
  'Last checked {date}': 'Última verificação: {date}',
  'Preview release': 'Versão de prévia',
  'View GitHub release': 'Ver versão no GitHub',
  'A check runs only when you choose it. Opening this page uses saved information.':
    'A verificação só é executada quando você a solicita. Abrir esta página usa as informações salvas.',
  'Release check finished. Review the result below.':
    'Verificação de versões concluída. Confira o resultado abaixo.',
  'Check releases': 'Verificar versões',
  'One check per minute. Checks inspect the first 20 published GitHub releases.':
    'Uma verificação por minuto. As verificações examinam as primeiras 20 versões publicadas no GitHub.',
  'This page reports versions. It does not install updates or verify release compatibility. Review release notes and back up data before upgrading.':
    'Esta página informa as versões. Ela não instala atualizações nem verifica a compatibilidade das versões. Leia as notas de versão e faça backup dos dados antes de atualizar.',
  'Only the owner can manage Besh release settings and update notices.':
    'Somente o proprietário pode gerenciar as configurações de versões do Besh e os avisos de atualização.',
  'YOUR WORKSPACE ACCESS': 'SEU ACESSO AO ESPAÇO DE TRABALHO',
  'Manage your email sign-in and active browser sessions.':
    'Gerencie seu acesso por e-mail e as sessões ativas do navegador.',
  'Loading your account…': 'Carregando sua conta…',
  'Sign-in details saved. Other browser sessions were revoked.':
    'Dados de acesso salvos. As outras sessões do navegador foram revogadas.',
  'Could not save sign-in details.':
    'Não foi possível salvar os dados de acesso.',
  'Optional. Your workspace key still works. Saving new details signs out your other browser sessions.':
    'Opcional. Sua chave do espaço de trabalho continua funcionando. Salvar novos dados encerra suas outras sessões do navegador.',
  'Account email': 'E-mail da conta',
  'Use 12 to 128 characters.': 'Use de 12 a 128 caracteres.',
  'Confirm your identity': 'Confirme sua identidade',
  'Current password': 'Senha atual',
  'Your workspace key': 'Sua chave do espaço de trabalho',
  'Save sign-in details': 'Salvar dados de acesso',
  'Active sessions': 'Sessões ativas',
  'Owners can revoke sessions across this workspace.':
    'Proprietários podem revogar sessões em todo este espaço de trabalho.',
  'Only your own active sessions appear here.':
    'Somente suas próprias sessões ativas aparecem aqui.',
  'Session expires {date}.': 'A sessão expira em {date}.',
  'Refresh sessions': 'Atualizar sessões',
  Member: 'Membro',
  Device: 'Dispositivo',
  'Last active': 'Última atividade',
  Expires: 'Expira',
  Access: 'Acesso',
  'This device': 'Este dispositivo',
  'Other browser session': 'Outra sessão do navegador',
  'Revoke session for {name} on this device':
    'Revogar sessão de {name} neste dispositivo',
  'Revoke session for {name}': 'Revogar sessão de {name}',
  'Revoke this session and sign out?': 'Revogar esta sessão e sair?',
  'Revoke this browser session for {name}?':
    'Revogar esta sessão do navegador de {name}?',
  'This session was revoked. Sign in again.':
    'Esta sessão foi revogada. Entre novamente.',
  'Browser session revoked.': 'Sessão do navegador revogada.',
  Revoke: 'Revogar',
  'No active sessions.': 'Nenhuma sessão ativa.',
  Language: 'Idioma',
  'Use device language': 'Usar idioma do dispositivo',
  Appearance: 'Aparência',
  Light: 'Claro',
  Dark: 'Escuro',
  System: 'Sistema',
  'API Studio': 'Estúdio de APIs',
  'Data sources': 'Fontes de dados',
  'Database connections': 'Conexões de banco de dados',
  'Product login': 'Login do produto',
  'Load testing': 'Testes de carga',
  'Audit trail': 'Registro de auditoria',
  Members: 'Membros',
  'Tenant protection': 'Proteção de tenants',
  'API keys': 'Chaves de API',
  'Account & sessions': 'Conta e sessões',
  'Data & backups': 'Dados e backups',
  Updates: 'Atualizações',
  'What’s next': 'Próximos passos',
  Workspace: 'Espaço de trabalho',
  'Local workspace': 'Espaço de trabalho local',
  WORKSPACE: 'ESPAÇO DE TRABALHO',
  'YOUR APIS': 'SUAS APIs',
  'New API': 'Nova API',
  'Workspace navigation': 'Navegação do espaço de trabalho',
  'Sign out': 'Sair',
  'Working…': 'Processando…',
  'Opening your workspace…': 'Abrindo seu espaço de trabalho…',
  'Opening invitation…': 'Abrindo convite…',
  'Opening studio…': 'Abrindo estúdio…',
  'Try again': 'Tentar novamente',
  'Help & roadmap': 'Ajuda e roteiro',
  'Drafts stay separate from published APIs':
    'Rascunhos ficam separados das APIs publicadas',
  'No APIs shared': 'Nenhuma API compartilhada',
  'Permission required': 'Permissão necessária',
  'Owner access required': 'Acesso de proprietário necessário',
  'Editor access required': 'Acesso de editor necessário',
  Save: 'Salvar',
  Cancel: 'Cancelar',
  Close: 'Fechar',
  Refresh: 'Atualizar',
  Search: 'Buscar',
  'API tools': 'Ferramentas de API',
  'Review details': 'Revisar detalhes',
  'Besh home': 'Início do Besh',
  'A SPACE FOR YOUR NEXT IDEA': 'UM ESPAÇO PARA SUA PRÓXIMA IDEIA',
  'Your next API.': 'Sua próxima API.',
  'Clearly connected.': 'Conectada com clareza.',
  'Turn an idea into an endpoint. Build visually, test your flow, and publish when you’re ready.':
    'Transforme uma ideia em um endpoint. Crie visualmente, teste o fluxo e publique quando estiver pronto.',
  'Start with a simple request.': 'Comece com uma solicitação simples.',
  'Ask for exactly what you need.': 'Peça exatamente o que precisa.',
  'JSON response': 'Resposta JSON',
  Request: 'Solicitação',
  Response: 'Resposta',
  'Your workspace. Your APIs. Private by default.':
    'Seu espaço. Suas APIs. Privados por padrão.',
  '02 / SAVE YOUR KEY': '02 / GUARDE SUA CHAVE',
  '01 / MAKE IT YOURS': '01 / DEIXE COM A SUA CARA',
  'WELCOME BACK': 'BEM-VINDO DE VOLTA',
  'Your workspace is ready.': 'Seu espaço de trabalho está pronto.',
  'A little setup. A lot of possibility.':
    'Pouca configuração. Muitas possibilidades.',
  'Open your workspace.': 'Abra seu espaço de trabalho.',
  'Keep this owner key safe. It is shown once.':
    'Guarde esta chave de proprietário com segurança. Ela aparece uma única vez.',
  'Choose a name for your workspace. We’ll create an owner key so you can get started.':
    'Escolha um nome para seu espaço. Vamos criar uma chave de proprietário para você começar.',
  'Sign in with email and password, or your owner or member key. Configure email sign-in in Account & sessions.':
    'Entre com email e senha ou com a chave de proprietário ou membro. Configure o login por email em Conta e sessões.',
  'Sign-in method': 'Método de login',
  'Workspace key': 'Chave do espaço de trabalho',
  'Email & password': 'Email e senha',
  'Workspace name': 'Nome do espaço de trabalho',
  'Setup key': 'Chave de configuração',
  'Open the setup link printed in your server terminal.':
    'Abra o link de configuração exibido no terminal do servidor.',
  'Visual API Studio': 'Estúdio visual de APIs',
  'Separate drafts and releases': 'Rascunhos e versões separados',
  'Private workspace': 'Espaço de trabalho privado',
  Email: 'Email',
  Password: 'Senha',
  'Your owner key': 'Sua chave de proprietário',
  'Workspace token': 'Token do espaço de trabalho',
  'Copy owner key': 'Copiar chave de proprietário',
  'I saved my owner key': 'Guardei minha chave de proprietário',
  'Your key creates a private browser session. The key is discarded after sign-in.':
    'Sua chave cria uma sessão privada no navegador. A chave é descartada após o login.',
  'Enter studio': 'Entrar no estúdio',
  'Create workspace': 'Criar espaço de trabalho',
  'Open workspace': 'Abrir espaço de trabalho',
  'A small start. Something worth building.':
    'Um pequeno começo. Algo que vale a pena criar.',
  'Workspace created. Save your owner key.':
    'Espaço criado. Guarde sua chave de proprietário.',
  'Owner key copied.': 'Chave de proprietário copiada.',
  'YOUR WORKSPACE INVITATION': 'SEU CONVITE PARA O ESPAÇO',
  'Your workspace invite.': 'Seu convite para o espaço de trabalho.',
  'Set up email sign-in for your existing member. Your role and API access do not change.':
    'Configure o login por email para seu membro existente. A função e o acesso às APIs não mudam.',
  'Accept invitation': 'Aceitar convite',
  'Password set': 'Senha definida',
  'Email sign-in is ready for {email}. You are not signed in yet.':
    'O login por email está pronto para {email}. Você ainda não entrou.',
  'Sign in': 'Entrar',
  'Reading invitation…': 'Lendo convite…',
  'Check invitation': 'Verificar convite',
  'Selected APIs': 'APIs selecionadas',
  'All APIs': 'Todas as APIs',
  'Expires {date}.': 'Expira em {date}.',
  'Current sign-in': 'Login atual',
  'Checking current sign-in…': 'Verificando login atual…',
  'You are signed in as {name}. Sign out explicitly before setting this member’s password.':
    'Você está conectado como {name}. Saia explicitamente antes de definir a senha deste membro.',
  'Sign out to accept invitation': 'Sair para aceitar convite',
  'Return to workspace': 'Voltar ao espaço de trabalho',
  'No workspace sign-in is active.':
    'Nenhum login do espaço de trabalho está ativo.',
  'Check current sign-in': 'Verificar login atual',
  'New password': 'Nova senha',
  'Invitation password': 'Nova senha',
  'Confirm password': 'Confirmar senha',
  'Confirm invitation password': 'Confirmar senha',
  'Use 12 to 128 characters. Your existing workspace key still works.':
    'Use de 12 a 128 caracteres. Sua chave atual continua funcionando.',
  'Set password': 'Definir senha',
  'Leave invitation and sign in': 'Sair do convite e entrar',
  'Discard unsaved draft changes and sign out to accept this invitation?':
    'Descartar alterações não salvas e sair para aceitar este convite?',
  'Passwords must match.': 'As senhas devem ser iguais.',
  'Could not read invitation.': 'Não foi possível ler o convite.',
  'Could not read your current sign-in.':
    'Não foi possível ler seu login atual.',
  'Current sign-in unknown. Check it before setting a password.':
    'Login atual desconhecido. Verifique antes de definir uma senha.',
  'Could not confirm sign-out. Check current sign-in before continuing; no automatic retry was made.':
    'Não foi possível confirmar a saída. Verifique o login antes de continuar; não houve nova tentativa automática.',
  'Could not confirm password setup.':
    'Não foi possível confirmar a definição da senha.',
  'No automatic retry was made. Try ordinary email sign-in if it may have succeeded, or ask the owner to refresh invitations and review a new link.':
    'Não houve nova tentativa automática. Se pode ter funcionado, tente entrar por email ou peça ao proprietário para atualizar os convites e revisar um novo link.',
  'Sign-in invitation': 'Convite para login',
  Invitations: 'Convites',
  'Set up email sign-in for an existing key-only member. Their role, API access and tenant assignment stay unchanged. Existing accounts cannot be reset with an invitation.':
    'Configure o login por email para um membro existente que usa apenas chave. Função, acesso às APIs e tenant atribuído não mudam. Convites não redefinem contas existentes.',
  'Refresh invitations': 'Atualizar convites',
  'Loading invitations…': 'Carregando convites…',
  'Current invitations unknown. Refresh needed.':
    'Convites atuais desconhecidos. Atualize a lista.',
  'Existing member': 'Membro existente',
  'Invitation member': 'Membro existente',
  'Invitation email': 'Email do convite',
  'Expires in 24 hours. Besh does not send email.':
    'Expira em 24 horas. O Besh não envia email.',
  'Anyone holding the link can set this member’s password. It does not prove email ownership. Share it privately. Creating another link invalidates this member’s earlier invitation; their workspace key still works.':
    'Qualquer pessoa com o link pode definir a senha deste membro. Isso não comprova a propriedade do email. Compartilhe em particular. Um novo link invalida o convite anterior; a chave do espaço continua funcionando.',
  'Create invitation link': 'Criar link de convite',
  'Save this invitation link': 'Guarde este link de convite',
  'Link status unconfirmed. Refresh invitations before sharing it.':
    'Status do link não confirmado. Atualize os convites antes de compartilhar.',
  'Current pending invitation.': 'Convite pendente atual.',
  'This invitation is no longer active. Its link cannot set a password.':
    'Este convite não está mais ativo. O link não pode definir uma senha.',
  'Invitation link': 'Link do convite',
  'Copy invitation link': 'Copiar link do convite',
  'I saved the link': 'Guardei o link',
  'Pending invitations': 'Convites pendentes',
  'Refresh to read current pending invitations.':
    'Atualize para ler os convites pendentes atuais.',
  'Revoke invitation': 'Revogar convite',
  'No pending invitations.': 'Nenhum convite pendente.',
  'Close invitations': 'Fechar convites',
  'Could not read invitations.': 'Não foi possível ler os convites.',
  'Refresh invitations before changing a link.':
    'Atualize os convites antes de alterar um link.',
  'Refresh invitations before trying again.':
    'Atualize os convites antes de tentar novamente.',
  'Could not confirm whether the invitation was created. Refresh invitations to review current links before reissuing or revoking.':
    'Não foi possível confirmar a criação do convite. Atualize para revisar os links atuais antes de reemitir ou revogar.',
  'Could not confirm whether the invitation was revoked. Refresh invitations before changing another link.':
    'Não foi possível confirmar a revogação do convite. Atualize antes de alterar outro link.',
  'Invitation created. Copy the link; it is shown once.':
    'Convite criado. Copie o link; ele aparece uma única vez.',
  'Invitation revoked. That link can no longer set a password.':
    'Convite revogado. O link não pode mais definir uma senha.',
  'Invitation link copied.': 'Link do convite copiado.',
  'Invitation unavailable': 'Convite indisponível',
  'Too many invitation attempts': 'Muitas tentativas de convite',
  'Email address unavailable': 'Endereço de email indisponível',
  'Invitation state unavailable': 'Estado dos convites indisponível',
  'Choose a member and valid email address':
    'Escolha um membro e um email válido',
  'Choose an existing member without an account':
    'Escolha um membro existente sem conta',
  'Pending invitation limit reached': 'Limite de convites pendentes atingido',
  'Provide an invitation token': 'Informe um token de convite',
  'Provide an invitation token and password of 12 to 128 characters':
    'Informe um token de convite e uma senha de 12 a 128 caracteres',
  'Invalid credentials': 'Credenciais inválidas',
  'Too many login attempts': 'Muitas tentativas de login',
  'Enter a valid email address': 'Digite um email válido',
  'Password must contain 12 to 128 characters':
    'A senha deve ter de 12 a 128 caracteres',
  'Email and password must be provided together':
    'Email e senha devem ser informados juntos',
  'Authentication required': 'Login necessário',
  'Permission denied': 'Permissão negada',
  'Workspace is shutting down': 'O espaço de trabalho está encerrando',
  'Browser origin rejected': 'Origem do navegador rejeitada',
  'Session verification required': 'Verificação de sessão necessária',
  'Your session expired. Sign in again.':
    'Sua sessão expirou. Entre novamente.',
  'Your session expired or was revoked. Sign in again.':
    'Sua sessão expirou ou foi revogada. Entre novamente.',
  'Signed out. This session was revoked.':
    'Você saiu. Esta sessão foi revogada.',
  'This session has already ended. Sign in again.':
    'Esta sessão já terminou. Entre novamente.',
  'Workspace ready.': 'Espaço de trabalho pronto.',
  'Connect your first idea.': 'Conecte sua primeira ideia.',
  'Request failed': 'A solicitação falhou',
  'Could not restore session.': 'Não foi possível restaurar a sessão.',
  'Invitation link unavailable. Ask the owner for a new link.':
    'Link de convite indisponível. Peça um novo link ao proprietário.',
  'nodePicker.open': 'Adicionar etapa',
  'Add step': 'Adicionar etapa',
  'nodePicker.title': 'Escolha uma etapa',
  'Choose a step': 'Escolha uma etapa',
  'nodePicker.search': 'Buscar etapas',
  'Search steps': 'Buscar etapas',
  'nodePicker.help':
    'Escolha uma etapa para este rascunho. Configure os campos após adicionar.',
  'Choose a step for this draft. Configure its fields after adding.':
    'Escolha uma etapa para este rascunho. Configure os campos após adicionar.',
  'nodePicker.all': 'Todas as etapas',
  'All steps': 'Todas as etapas',
  'nodePicker.favorites': 'Favoritos',
  Favorites: 'Favoritos',
  'nodePicker.empty': 'Nenhuma etapa encontrada.',
  'No steps found.': 'Nenhuma etapa encontrada.',
  'nodePicker.noFavorites': 'Nenhuma etapa favorita ainda.',
  'No favorite steps yet.': 'Nenhuma etapa favorita ainda.',
  'nodePicker.favorite': 'Favoritar {name}',
  'Favorite {name}': 'Favoritar {name}',
  'nodePicker.unfavorite': 'Remover {name} dos favoritos',
  'Remove {name} from favorites': 'Remover {name} dos favoritos',
  'nodePicker.add': 'Adicionar {name}',
  'Add {name}': 'Adicionar {name}',
  'nodePicker.close': 'Fechar seletor de etapas',
  'Close step picker': 'Fechar seletor de etapas',
  'nodePicker.unavailable': 'Indisponível para esta API',
  'Unavailable for this API': 'Indisponível para esta API',
  'nodePicker.requestExists': 'Esta API já tem uma etapa de solicitação.',
  'This API already has a request step.':
    'Esta API já tem uma etapa de solicitação.',
  'nodePicker.category.api': 'API',
  API: 'API',
  'nodePicker.category.logic': 'Lógica',
  Logic: 'Lógica',
  'nodePicker.category.data': 'Dados',
  Data: 'Dados',
  'nodePicker.category.identity': 'Login do produto',
  'nodePicker.categories': 'Categorias de etapas',
  'Step categories': 'Categorias de etapas',
  'nodePicker.results': 'Etapas correspondentes',
  'Matching steps': 'Etapas correspondentes',
  'nodes.request.label': 'Solicitação HTTP',
  'HTTP request': 'Solicitação HTTP',
  'nodes.request.description': 'Inicia a API e recebe a entrada.',
  'Start the API and receive its input.': 'Inicia a API e recebe a entrada.',
  'nodes.response.label': 'Resposta JSON',
  'nodes.response.description': 'Envia o resultado da API para quem a chamou.',
  'Send the API result back to its caller.':
    'Envia o resultado da API para quem a chamou.',
  'nodes.condition.label': 'Condição',
  Condition: 'Condição',
  'nodes.condition.description':
    'Compara um valor de entrada e escolhe o próximo caminho.',
  'Compare an input value and choose the next path.':
    'Compara um valor de entrada e escolhe o próximo caminho.',
  'nodes.data.label': 'Linhas da planilha',
  'Spreadsheet rows': 'Linhas da planilha',
  'nodes.data.description':
    'Lê campos escolhidos de uma planilha importada ou de um Google Sheet salvo.',
  'Read chosen fields from an imported spreadsheet or saved Google Sheet.':
    'Lê campos escolhidos de uma planilha importada ou de um Google Sheet salvo.',
  'nodes.database.label': 'Linhas do SQLite',
  'SQLite rows': 'Linhas do SQLite',
  'nodes.database.description':
    'Lê campos escolhidos de uma cópia SQLite enviada.',
  'Read chosen fields from an uploaded SQLite copy.':
    'Lê campos escolhidos de uma cópia SQLite enviada.',
  'nodes.social.label': 'Login com GitHub',
  'GitHub login': 'Login com GitHub',
  'nodes.social.description': 'Adiciona login com GitHub à API do produto.',
  'Add GitHub sign-in to the product API.':
    'Adiciona login com GitHub à API do produto.',
  'nodes.wsRequest.label': 'Receber mensagem',
  'Receive message': 'Receber mensagem',
  'nodes.wsRequest.description': 'Recebe uma mensagem WebSocket tipada.',
  'Receive one typed WebSocket message.':
    'Recebe uma mensagem WebSocket tipada.',
  'nodes.wsResponse.label': 'Enviar resposta',
  'Send reply': 'Enviar resposta',
  'nodes.wsResponse.description': 'Envia uma resposta WebSocket tipada.',
  'Send one typed WebSocket reply.': 'Envia uma resposta WebSocket tipada.',
  'API editing is unavailable.': 'A edição de API está indisponível.',
  'This API already has 64 steps.': 'Esta API já tem 64 etapas.',
  'This API already has a starting step.': 'Esta API já tem uma etapa inicial.',
  'This step is unavailable for WebSocket request/reply.':
    'Esta etapa não está disponível para solicitação/resposta WebSocket.',
  'This WebSocket API already has a reply step.':
    'Esta API WebSocket já tem uma etapa de resposta.',
  'WebSocket request/reply supports one data read.':
    'Solicitação/resposta WebSocket suporta uma leitura de dados.',
  Draft: 'Rascunho',
  'Unsaved changes': 'Alterações não salvas',
  Saved: 'Salvo',
  'Save draft': 'Salvar rascunho',
  Publish: 'Publicar',
  'API name': 'Nome da API',
  'API NAME': 'NOME DA API',
  'API TYPE': 'TIPO DE API',
  'API type': 'Tipo de API',
  METHOD: 'MÉTODO',
  'HTTP method': 'Método HTTP',
  'ENDPOINT PATH': 'CAMINHO DO ENDPOINT',
  'Endpoint path': 'Caminho do endpoint',
  'Test flow': 'Testar fluxo',
  'Request input': 'Entrada da solicitação',
  'Apply configuration': 'Aplicar configuração',
  'Remove node': 'Remover nó',
  'Advanced configuration': 'Configuração avançada',
  'Node configuration': 'Configuração do nó',
  'Create your first API': 'Crie sua primeira API',
  'Start with a spreadsheet': 'Começar com uma planilha',
  'Build a blank API': 'Criar uma API em branco',
  'Response status': 'Status da resposta',
  'Response contents': 'Conteúdo da resposta',
  'Response fields': 'Campos da resposta',
  'Rows from data step': 'Linhas da etapa de dados',
  'GitHub login result': 'Resultado do login com GitHub',
  'Input source': 'Origem da entrada',
  'Input field': 'Campo de entrada',
  Comparison: 'Comparação',
  Equals: 'Igual a',
  'Expected type': 'Tipo esperado',
  'Expected value': 'Valor esperado',
  Text: 'Texto',
  Number: 'Número',
  'True or false': 'Verdadeiro ou falso',
  'Empty value': 'Valor vazio',
  'Request body': 'Corpo da solicitação',
  'Query parameter': 'Parâmetro de consulta',
  'Path parameter': 'Parâmetro de caminho',
  'From request body': 'Do corpo da solicitação',
  'From query parameter': 'Do parâmetro de consulta',
  'From path parameter': 'Do parâmetro de caminho',
  'Nested data (preserved)': 'Dados aninhados (preservados)',
  True: 'Verdadeiro',
  False: 'Falso',
  'Path parameters': 'Parâmetros de caminho',
  'Query parameters': 'Parâmetros de consulta',
  'Request body fields': 'Campos do corpo da solicitação',
  'Add query parameter': 'Adicionar parâmetro de consulta',
  'Add body field': 'Adicionar campo do corpo',
  'Add response field': 'Adicionar campo da resposta',
  '{prefix} name {number}': 'Nome de {prefix} {number}',
  '{prefix} type {number}': 'Tipo de {prefix} {number}',
  '{prefix} value {number}': 'Valor de {prefix} {number}',
  'Remove {prefix} field {number}': 'Remover campo de {prefix} {number}',
  'Path parameter {name}': 'Parâmetro de caminho {name}',
  'Value for :{name}': 'Valor de :{name}',
  Field: 'Campo',
  Body: 'Corpo',
  Query: 'Consulta',
  'Finish opening your workspace or the current action, then reopen the invitation link. Your draft was kept.':
    'Conclua a abertura do espaço ou a ação atual e abra o convite novamente. Seu rascunho foi mantido.',
  'Leave the editor to review this invitation? Your unsaved draft will be kept until you return or confirm sign-out.':
    'Sair do editor para revisar este convite? O rascunho não salvo será mantido até você voltar ou confirmar a saída.',
  'Discard unsaved draft changes and open sign-in?':
    'Descartar alterações não salvas e abrir o login?',
  'Workspace already configured': 'Espaço de trabalho já configurado',
  'Open the setup link from your server terminal':
    'Abra o link de configuração no terminal do servidor',
  'HTTPS browser origin required': 'Origem HTTPS do navegador necessária',
  'Invitation revocation takes no fields':
    'A revogação do convite não aceita campos',
  'Request failed ({status}).': 'A solicitação falhou ({status}).',
  'Invalid request': 'Solicitação inválida',
  'Invalid request body': 'Corpo da solicitação inválido',
  'REST API': 'REST API',
  'GraphQL API': 'GraphQL API',
  'Remove field {number}': 'Remover campo {number}',
  'NODE SETTINGS': 'CONFIGURAÇÕES DO NÓ',
  'BUILD SOMETHING USEFUL': 'CRIE ALGO ÚTIL',
  'Connect the dots. Let your API do the work.':
    'Conecte os pontos. Deixe sua API fazer o trabalho.',
  'API key protected': 'Protegida por chave de API',
  'Published endpoint URL': 'URL do endpoint publicado',
  'Flow canvas': 'Área do fluxo',
  'New draft': 'Novo rascunho',
  'Try it out': 'Experimente',
  'WAITING FOR A RUN': 'AGUARDANDO EXECUÇÃO',
  'Use this API': 'Usar esta API',
  'Generated backend': 'Backend gerado',
  'Your API starts here': 'Sua API começa aqui',
  'Choose a path': 'Escolha um caminho',
  'Send something back': 'Envie algo de volta',
  'Read selected columns': 'Ler colunas selecionadas',
  'Read an uploaded copy': 'Ler uma cópia enviada',
  'Resolve a product identity': 'Identificar um usuário do produto',
  'Data source': 'Fonte de dados',
  'Maximum rows': 'Máximo de linhas',
  'Filter rows': 'Filtrar linhas',
  'Match one column': 'Comparar uma coluna',
  'Match column': 'Coluna para comparação',
  'Match value type': 'Tipo do valor de comparação',
  'Fixed text': 'Texto fixo',
  'Fixed number': 'Número fixo',
  'Match value': 'Valor de comparação',
  'Include {name}': 'Incluir {name}',
  'API field: {name}': 'Campo da API: {name}',
  'Small steps. Powerful APIs.': 'Pequenas etapas. APIs poderosas.',
  'Build a flow you can understand, test, and trust.':
    'Crie um fluxo que você entende, testa e confia.',
  owner: 'proprietário',
  editor: 'editor',
  viewer: 'visualizador',
  'Unknown role': 'Função desconhecida',
  'Custom role': 'Função personalizada',
  'Loading saved source details…': 'Carregando os detalhes das fontes salvas…',
  'No saved sources are available. Import a spreadsheet in Data sources, then return to this step.':
    'Não há fontes salvas. Importe uma planilha em Fontes de dados e volte a esta etapa.',
  'No allowed sources are available. Ask the owner to review source USE for your selected APIs.':
    'Não há fontes permitidas. Peça ao proprietário para revisar as permissões USE das fontes das APIs compartilhadas.',
  'Choose a saved source to configure this step.':
    'Escolha uma fonte salva para configurar esta etapa.',
  'Source details could not be loaded. Check the error above.':
    'Não foi possível carregar os detalhes das fontes. Confira o erro acima.',
  'Source access is required. Ask the owner to review your permissions and source USE.':
    'É necessário ter acesso às fontes. Peça ao proprietário para revisar suas permissões e as permissões USE das fontes.',
  'No sources are available to this account. Ask the owner to provide a source.':
    'Não há fontes disponíveis para esta conta. Peça ao proprietário para fornecer uma fonte.',
  'Start with your spreadsheet, or build a blank API using the request and response below. Opening either path does not save or publish an API. You choose when to create or save its draft.':
    'Comece com sua planilha ou crie uma API em branco usando a solicitação e a resposta abaixo. Abrir qualquer opção não salva nem publica uma API. Você escolhe quando criar ou salvar o rascunho.',
  'Your next idea starts here.': 'Sua próxima ideia começa aqui.',
  'Create your first API.': 'Crie sua primeira API.',
  'Live · v{version}': 'Em produção · v{version}',
  'Saved · revision {revision}': 'Salvo · revisão {revision}',
  '{nodes} nodes · {connections} connections':
    'Nós: {nodes} · Conexões: {connections}',
  'Use /v1/customers/:id for a versioned route with a path parameter. Each :name occupies a whole route segment.':
    'Use /v1/customers/:id para uma rota com versão e parâmetro de caminho. Cada :name ocupa um segmento inteiro da rota.',
  'Owner and member keys manage drafts. Create an API key in API keys to call a published endpoint.':
    'As chaves do proprietário e dos membros gerenciam rascunhos. Crie uma chave de API em Chaves de API para chamar um endpoint publicado.',
  'REQUEST DETAILS': 'DETALHES DA SOLICITAÇÃO',
  '// Save your draft, then run a test.\n// Your response will appear here.':
    '// Salve o rascunho e execute um teste.\n// Sua resposta aparecerá aqui.',
  'Discard unsaved draft changes?':
    'Descartar as alterações não salvas do rascunho?',
  'Use an exact path, such as /v1/customers. GraphQL arguments carry input values.':
    'Use um caminho exato, como /v1/customers. Os argumentos GraphQL transportam os valores de entrada.',
  'GRAPHQL OPERATION': 'OPERAÇÃO GRAPHQL',
  'Use an exact path, such as /v1/messages. WebSocket messages carry input values; named path parameters are not supported.':
    'Use um caminho exato, como /v1/messages. As mensagens WebSocket transportam os valores de entrada; parâmetros de caminho nomeados não são suportados.',
}

export default messages
