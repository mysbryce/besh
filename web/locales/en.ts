const messages: Record<string, string> = {
  'Update available': 'Update available',
  'No newer release found': 'No newer release found',
  'No matching releases found': 'No matching releases found',
  'Release check failed': 'Release check failed',
  'Owner access required to manage Besh updates.':
    'Owner access required to manage Besh updates.',
  'Could not load update information.': 'Could not load update information.',
  'YOUR BESH INSTALLATION': 'YOUR BESH INSTALLATION',
  'Besh updates': 'Besh updates',
  'Check public GitHub releases when you are ready.':
    'Check public GitHub releases when you are ready.',
  'Discard unsaved update settings and refresh?':
    'Discard unsaved update settings and refresh?',
  'Refresh update settings': 'Refresh update settings',
  'Loading update settings…': 'Loading update settings…',
  'Update settings saved. Check releases to get a fresh result.':
    'Update settings saved. Check releases to get a fresh result.',
  'Release settings': 'Release settings',
  'GitHub repository': 'GitHub repository',
  'Use a public repository URL. Private repositories and access tokens are not supported.':
    'Use a public repository URL. Private repositories and access tokens are not supported.',
  'Include preview releases': 'Include preview releases',
  'Show alpha, beta and other prereleases alongside stable versions.':
    'Show alpha, beta and other prereleases alongside stable versions.',
  'Save update settings': 'Save update settings',
  'Save your changes before checking releases.':
    'Save your changes before checking releases.',
  'Release status': 'Release status',
  'Installed {version}': 'Installed {version}',
  'No release check yet': 'No release check yet',
  'Last checked {date}': 'Last checked {date}',
  'Preview release': 'Preview release',
  'View GitHub release': 'View GitHub release',
  'A check runs only when you choose it. Opening this page uses saved information.':
    'A check runs only when you choose it. Opening this page uses saved information.',
  'Release check finished. Review the result below.':
    'Release check finished. Review the result below.',
  'Check releases': 'Check releases',
  'One check per minute. Checks inspect the first 20 published GitHub releases.':
    'One check per minute. Checks inspect the first 20 published GitHub releases.',
  'This page reports versions. It does not install updates or verify release compatibility. Review release notes and back up data before upgrading.':
    'This page reports versions. It does not install updates or verify release compatibility. Review release notes and back up data before upgrading.',
  'Only the owner can manage Besh release settings and update notices.':
    'Only the owner can manage Besh release settings and update notices.',
  'YOUR WORKSPACE ACCESS': 'YOUR WORKSPACE ACCESS',
  'Manage your email sign-in and active browser sessions.':
    'Manage your email sign-in and active browser sessions.',
  'Loading your account…': 'Loading your account…',
  'Sign-in details saved. Other browser sessions were revoked.':
    'Sign-in details saved. Other browser sessions were revoked.',
  'Could not save sign-in details.': 'Could not save sign-in details.',
  'Optional. Your workspace key still works. Saving new details signs out your other browser sessions.':
    'Optional. Your workspace key still works. Saving new details signs out your other browser sessions.',
  'Account email': 'Account email',
  'Use 12 to 128 characters.': 'Use 12 to 128 characters.',
  'Confirm your identity': 'Confirm your identity',
  'Current password': 'Current password',
  'Your workspace key': 'Your workspace key',
  'Save sign-in details': 'Save sign-in details',
  'Active sessions': 'Active sessions',
  'Owners can revoke sessions across this workspace.':
    'Owners can revoke sessions across this workspace.',
  'Only your own active sessions appear here.':
    'Only your own active sessions appear here.',
  'Session expires {date}.': 'Session expires {date}.',
  'Refresh sessions': 'Refresh sessions',
  Member: 'Member',
  Device: 'Device',
  'Last active': 'Last active',
  Expires: 'Expires',
  Access: 'Access',
  'This device': 'This device',
  'Other browser session': 'Other browser session',
  'Revoke session for {name} on this device':
    'Revoke session for {name} on this device',
  'Revoke session for {name}': 'Revoke session for {name}',
  'Revoke this session and sign out?': 'Revoke this session and sign out?',
  'Revoke this browser session for {name}?':
    'Revoke this browser session for {name}?',
  'This session was revoked. Sign in again.':
    'This session was revoked. Sign in again.',
  'Browser session revoked.': 'Browser session revoked.',
  Revoke: 'Revoke',
  'No active sessions.': 'No active sessions.',
  'nodePicker.open': 'Add step',
  'nodePicker.title': 'Choose a step',
  'nodePicker.search': 'Search steps',
  'nodePicker.help':
    'Choose a step for this draft. Configure its fields after adding.',
  'nodePicker.all': 'All steps',
  'nodePicker.favorites': 'Favorites',
  'nodePicker.empty': 'No steps found.',
  'nodePicker.noFavorites': 'No favorite steps yet.',
  'nodePicker.favorite': 'Favorite {name}',
  'nodePicker.unfavorite': 'Remove {name} from favorites',
  'nodePicker.add': 'Add {name}',
  'nodePicker.close': 'Close step picker',
  'nodePicker.unavailable': 'Unavailable for this API',
  'nodePicker.requestExists': 'This API already has a request step.',
  'nodePicker.category.api': 'API',
  'nodePicker.category.logic': 'Logic',
  'nodePicker.category.data': 'Data',
  'nodePicker.category.identity': 'Product login',
  'nodePicker.categories': 'Step categories',
  'nodePicker.results': 'Matching steps',
  'nodes.request.label': 'HTTP request',
  'nodes.request.description': 'Start the API and receive its input.',
  'nodes.response.label': 'JSON response',
  'nodes.response.description': 'Send the API result back to its caller.',
  'nodes.condition.label': 'Condition',
  'nodes.condition.description':
    'Compare an input value and choose the next path.',
  'nodes.data.label': 'Spreadsheet rows',
  'nodes.data.description':
    'Read chosen fields from an imported spreadsheet or saved Google Sheet.',
  'nodes.database.label': 'SQLite rows',
  'nodes.database.description':
    'Read chosen fields from an uploaded SQLite copy.',
  'nodes.social.label': 'GitHub login',
  'nodes.social.description': 'Add GitHub sign-in to the product API.',
  'nodes.wsRequest.label': 'Receive message',
  'nodes.wsRequest.description': 'Receive one typed WebSocket message.',
  'nodes.wsResponse.label': 'Send reply',
  'nodes.wsResponse.description': 'Send one typed WebSocket reply.',
  'Use device language': 'Use device language',
  'API Studio': 'API Studio',
  'Data sources': 'Data sources',
  'Database connections': 'Database connections',
  'Product login': 'Product login',
  'Load testing': 'Load testing',
  'Audit trail': 'Audit trail',
  'Tenant protection': 'Tenant protection',
  'API keys': 'API keys',
  'Account & sessions': 'Account & sessions',
  'Data & backups': 'Data & backups',
  'What’s next': 'What’s next',
  'Local workspace': 'Local workspace',
  'YOUR APIS': 'YOUR APIS',
  'New API': 'New API',
  'Workspace navigation': 'Workspace navigation',
  'Sign out': 'Sign out',
  'Working…': 'Working…',
  'Opening your workspace…': 'Opening your workspace…',
  'Opening invitation…': 'Opening invitation…',
  'Opening studio…': 'Opening studio…',
  'Try again': 'Try again',
  'Help & roadmap': 'Help & roadmap',
  'Drafts stay separate from published APIs':
    'Drafts stay separate from published APIs',
  'No APIs shared': 'No APIs shared',
  'Permission required': 'Permission required',
  'Owner access required': 'Owner access required',
  'Editor access required': 'Editor access required',
  'API tools': 'API tools',
  'Review details': 'Review details',
  'Besh home': 'Besh home',
  'A SPACE FOR YOUR NEXT IDEA': 'A SPACE FOR YOUR NEXT IDEA',
  'Your next API.': 'Your next API.',
  'Clearly connected.': 'Clearly connected.',
  'Turn an idea into an endpoint. Build visually, test your flow, and publish when you’re ready.':
    'Turn an idea into an endpoint. Build visually, test your flow, and publish when you’re ready.',
  'Start with a simple request.': 'Start with a simple request.',
  'Ask for exactly what you need.': 'Ask for exactly what you need.',
  'JSON response': 'JSON response',
  'Your workspace. Your APIs. Private by default.':
    'Your workspace. Your APIs. Private by default.',
  '02 / SAVE YOUR KEY': '02 / SAVE YOUR KEY',
  '01 / MAKE IT YOURS': '01 / MAKE IT YOURS',
  'WELCOME BACK': 'WELCOME BACK',
  'Your workspace is ready.': 'Your workspace is ready.',
  'A little setup. A lot of possibility.':
    'A little setup. A lot of possibility.',
  'Open your workspace.': 'Open your workspace.',
  'Keep this owner key safe. It is shown once.':
    'Keep this owner key safe. It is shown once.',
  'Choose a name for your workspace. We’ll create an owner key so you can get started.':
    'Choose a name for your workspace. We’ll create an owner key so you can get started.',
  'Sign in with email and password, or your owner or member key. Configure email sign-in in Account & sessions.':
    'Sign in with email and password, or your owner or member key. Configure email sign-in in Account & sessions.',
  'Sign-in method': 'Sign-in method',
  'Workspace key': 'Workspace key',
  'Email & password': 'Email & password',
  'Workspace name': 'Workspace name',
  'Setup key': 'Setup key',
  'Open the setup link printed in your server terminal.':
    'Open the setup link printed in your server terminal.',
  'Visual API Studio': 'Visual API Studio',
  'Separate drafts and releases': 'Separate drafts and releases',
  'Private workspace': 'Private workspace',
  'Your owner key': 'Your owner key',
  'Workspace token': 'Workspace token',
  'Copy owner key': 'Copy owner key',
  'I saved my owner key': 'I saved my owner key',
  'Your key creates a private browser session. The key is discarded after sign-in.':
    'Your key creates a private browser session. The key is discarded after sign-in.',
  'Enter studio': 'Enter studio',
  'Create workspace': 'Create workspace',
  'Open workspace': 'Open workspace',
  'A small start. Something worth building.':
    'A small start. Something worth building.',
  'Workspace created. Save your owner key.':
    'Workspace created. Save your owner key.',
  'Owner key copied.': 'Owner key copied.',
  'YOUR WORKSPACE INVITATION': 'YOUR WORKSPACE INVITATION',
  'Your workspace invite.': 'Your workspace invite.',
  'Set up email sign-in for your existing member. Your role and API access do not change.':
    'Set up email sign-in for your existing member. Your role and API access do not change.',
  'Accept invitation': 'Accept invitation',
  'Password set': 'Password set',
  'Email sign-in is ready for {email}. You are not signed in yet.':
    'Email sign-in is ready for {email}. You are not signed in yet.',
  'Sign in': 'Sign in',
  'Reading invitation…': 'Reading invitation…',
  'Check invitation': 'Check invitation',
  'Selected APIs': 'Selected APIs',
  'All APIs': 'All APIs',
  'Expires {date}.': 'Expires {date}.',
  'Current sign-in': 'Current sign-in',
  'Checking current sign-in…': 'Checking current sign-in…',
  'You are signed in as {name}. Sign out explicitly before setting this member’s password.':
    'You are signed in as {name}. Sign out explicitly before setting this member’s password.',
  'Sign out to accept invitation': 'Sign out to accept invitation',
  'Return to workspace': 'Return to workspace',
  'No workspace sign-in is active.': 'No workspace sign-in is active.',
  'Check current sign-in': 'Check current sign-in',
  'New password': 'New password',
  'Invitation password': 'Invitation password',
  'Confirm password': 'Confirm password',
  'Confirm invitation password': 'Confirm invitation password',
  'Use 12 to 128 characters. Your existing workspace key still works.':
    'Use 12 to 128 characters. Your existing workspace key still works.',
  'Set password': 'Set password',
  'Leave invitation and sign in': 'Leave invitation and sign in',
  'Discard unsaved draft changes and sign out to accept this invitation?':
    'Discard unsaved draft changes and sign out to accept this invitation?',
  'Passwords must match.': 'Passwords must match.',
  'Could not read invitation.': 'Could not read invitation.',
  'Could not read your current sign-in.':
    'Could not read your current sign-in.',
  'Current sign-in unknown. Check it before setting a password.':
    'Current sign-in unknown. Check it before setting a password.',
  'Could not confirm sign-out. Check current sign-in before continuing; no automatic retry was made.':
    'Could not confirm sign-out. Check current sign-in before continuing; no automatic retry was made.',
  'Could not confirm password setup.': 'Could not confirm password setup.',
  'No automatic retry was made. Try ordinary email sign-in if it may have succeeded, or ask the owner to refresh invitations and review a new link.':
    'No automatic retry was made. Try ordinary email sign-in if it may have succeeded, or ask the owner to refresh invitations and review a new link.',
  'Sign-in invitation': 'Sign-in invitation',
  'Set up email sign-in for an existing key-only member. Their role, API access and tenant assignment stay unchanged. Existing accounts cannot be reset with an invitation.':
    'Set up email sign-in for an existing key-only member. Their role, API access and tenant assignment stay unchanged. Existing accounts cannot be reset with an invitation.',
  'Refresh invitations': 'Refresh invitations',
  'Loading invitations…': 'Loading invitations…',
  'Current invitations unknown. Refresh needed.':
    'Current invitations unknown. Refresh needed.',
  'Existing member': 'Existing member',
  'Invitation member': 'Invitation member',
  'Invitation email': 'Invitation email',
  'Expires in 24 hours. Besh does not send email.':
    'Expires in 24 hours. Besh does not send email.',
  'Anyone holding the link can set this member’s password. It does not prove email ownership. Share it privately. Creating another link invalidates this member’s earlier invitation; their workspace key still works.':
    'Anyone holding the link can set this member’s password. It does not prove email ownership. Share it privately. Creating another link invalidates this member’s earlier invitation; their workspace key still works.',
  'Create invitation link': 'Create invitation link',
  'Save this invitation link': 'Save this invitation link',
  'Link status unconfirmed. Refresh invitations before sharing it.':
    'Link status unconfirmed. Refresh invitations before sharing it.',
  'Current pending invitation.': 'Current pending invitation.',
  'This invitation is no longer active. Its link cannot set a password.':
    'This invitation is no longer active. Its link cannot set a password.',
  'Invitation link': 'Invitation link',
  'Copy invitation link': 'Copy invitation link',
  'I saved the link': 'I saved the link',
  'Pending invitations': 'Pending invitations',
  'Refresh to read current pending invitations.':
    'Refresh to read current pending invitations.',
  'Revoke invitation': 'Revoke invitation',
  'No pending invitations.': 'No pending invitations.',
  'Close invitations': 'Close invitations',
  'Could not read invitations.': 'Could not read invitations.',
  'Refresh invitations before changing a link.':
    'Refresh invitations before changing a link.',
  'Refresh invitations before trying again.':
    'Refresh invitations before trying again.',
  'Could not confirm whether the invitation was created. Refresh invitations to review current links before reissuing or revoking.':
    'Could not confirm whether the invitation was created. Refresh invitations to review current links before reissuing or revoking.',
  'Could not confirm whether the invitation was revoked. Refresh invitations before changing another link.':
    'Could not confirm whether the invitation was revoked. Refresh invitations before changing another link.',
  'Invitation created. Copy the link; it is shown once.':
    'Invitation created. Copy the link; it is shown once.',
  'Invitation revoked. That link can no longer set a password.':
    'Invitation revoked. That link can no longer set a password.',
  'Invitation link copied.': 'Invitation link copied.',
  'Invitation unavailable': 'Invitation unavailable',
  'Too many invitation attempts': 'Too many invitation attempts',
  'Email address unavailable': 'Email address unavailable',
  'Invitation state unavailable': 'Invitation state unavailable',
  'Choose a member and valid email address':
    'Choose a member and valid email address',
  'Choose an existing member without an account':
    'Choose an existing member without an account',
  'Pending invitation limit reached': 'Pending invitation limit reached',
  'Provide an invitation token': 'Provide an invitation token',
  'Provide an invitation token and password of 12 to 128 characters':
    'Provide an invitation token and password of 12 to 128 characters',
  'Invalid credentials': 'Invalid credentials',
  'Too many login attempts': 'Too many login attempts',
  'Enter a valid email address': 'Enter a valid email address',
  'Password must contain 12 to 128 characters':
    'Password must contain 12 to 128 characters',
  'Email and password must be provided together':
    'Email and password must be provided together',
  'Authentication required': 'Authentication required',
  'Permission denied': 'Permission denied',
  'Workspace is shutting down': 'Workspace is shutting down',
  'Browser origin rejected': 'Browser origin rejected',
  'Session verification required': 'Session verification required',
  'Your session expired. Sign in again.':
    'Your session expired. Sign in again.',
  'Your session expired or was revoked. Sign in again.':
    'Your session expired or was revoked. Sign in again.',
  'Signed out. This session was revoked.':
    'Signed out. This session was revoked.',
  'This session has already ended. Sign in again.':
    'This session has already ended. Sign in again.',
  'Workspace ready.': 'Workspace ready.',
  'Connect your first idea.': 'Connect your first idea.',
  'Request failed': 'Request failed',
  'Could not restore session.': 'Could not restore session.',
  'Invitation link unavailable. Ask the owner for a new link.':
    'Invitation link unavailable. Ask the owner for a new link.',
  'Add step': 'Add step',
  'Choose a step': 'Choose a step',
  'Search steps': 'Search steps',
  'Choose a step for this draft. Configure its fields after adding.':
    'Choose a step for this draft. Configure its fields after adding.',
  'All steps': 'All steps',
  'No steps found.': 'No steps found.',
  'No favorite steps yet.': 'No favorite steps yet.',
  'Favorite {name}': 'Favorite {name}',
  'Remove {name} from favorites': 'Remove {name} from favorites',
  'Add {name}': 'Add {name}',
  'Close step picker': 'Close step picker',
  'Unavailable for this API': 'Unavailable for this API',
  'This API already has a request step.':
    'This API already has a request step.',
  'Step categories': 'Step categories',
  'Matching steps': 'Matching steps',
  'HTTP request': 'HTTP request',
  'Start the API and receive its input.':
    'Start the API and receive its input.',
  'Send the API result back to its caller.':
    'Send the API result back to its caller.',
  'Compare an input value and choose the next path.':
    'Compare an input value and choose the next path.',
  'Spreadsheet rows': 'Spreadsheet rows',
  'Read chosen fields from an imported spreadsheet or saved Google Sheet.':
    'Read chosen fields from an imported spreadsheet or saved Google Sheet.',
  'SQLite rows': 'SQLite rows',
  'Read chosen fields from an uploaded SQLite copy.':
    'Read chosen fields from an uploaded SQLite copy.',
  'GitHub login': 'GitHub login',
  'Add GitHub sign-in to the product API.':
    'Add GitHub sign-in to the product API.',
  'Receive message': 'Receive message',
  'Receive one typed WebSocket message.':
    'Receive one typed WebSocket message.',
  'Send reply': 'Send reply',
  'Send one typed WebSocket reply.': 'Send one typed WebSocket reply.',
  'API editing is unavailable.': 'API editing is unavailable.',
  'This API already has 64 steps.': 'This API already has 64 steps.',
  'This API already has a starting step.':
    'This API already has a starting step.',
  'This step is unavailable for WebSocket request/reply.':
    'This step is unavailable for WebSocket request/reply.',
  'This WebSocket API already has a reply step.':
    'This WebSocket API already has a reply step.',
  'WebSocket request/reply supports one data read.':
    'WebSocket request/reply supports one data read.',
  'Unsaved changes': 'Unsaved changes',
  'Save draft': 'Save draft',
  'API name': 'API name',
  'API NAME': 'API NAME',
  'API TYPE': 'API TYPE',
  'API type': 'API type',
  'HTTP method': 'HTTP method',
  'ENDPOINT PATH': 'ENDPOINT PATH',
  'Endpoint path': 'Endpoint path',
  'Test flow': 'Test flow',
  'Request input': 'Request input',
  'Apply configuration': 'Apply configuration',
  'Remove node': 'Remove node',
  'Advanced configuration': 'Advanced configuration',
  'Node configuration': 'Node configuration',
  'Create your first API': 'Create your first API',
  'Start with a spreadsheet': 'Start with a spreadsheet',
  'Build a blank API': 'Build a blank API',
  'Response status': 'Response status',
  'Response contents': 'Response contents',
  'Response fields': 'Response fields',
  'Rows from data step': 'Rows from data step',
  'GitHub login result': 'GitHub login result',
  'Input source': 'Input source',
  'Input field': 'Input field',
  'Expected type': 'Expected type',
  'Expected value': 'Expected value',
  'True or false': 'True or false',
  'Empty value': 'Empty value',
  'Request body': 'Request body',
  'Query parameter': 'Query parameter',
  'Path parameter': 'Path parameter',
  'From request body': 'From request body',
  'From query parameter': 'From query parameter',
  'From path parameter': 'From path parameter',
  'Nested data (preserved)': 'Nested data (preserved)',
  'Path parameters': 'Path parameters',
  'Query parameters': 'Query parameters',
  'Request body fields': 'Request body fields',
  'Add query parameter': 'Add query parameter',
  'Add body field': 'Add body field',
  'Add response field': 'Add response field',
  '{prefix} name {number}': '{prefix} name {number}',
  '{prefix} type {number}': '{prefix} type {number}',
  '{prefix} value {number}': '{prefix} value {number}',
  'Remove {prefix} field {number}': 'Remove {prefix} field {number}',
  'Path parameter {name}': 'Path parameter {name}',
  'Value for :{name}': 'Value for :{name}',
  'Finish opening your workspace or the current action, then reopen the invitation link. Your draft was kept.':
    'Finish opening your workspace or the current action, then reopen the invitation link. Your draft was kept.',
  'Leave the editor to review this invitation? Your unsaved draft will be kept until you return or confirm sign-out.':
    'Leave the editor to review this invitation? Your unsaved draft will be kept until you return or confirm sign-out.',
  'Discard unsaved draft changes and open sign-in?':
    'Discard unsaved draft changes and open sign-in?',
  'Workspace already configured': 'Workspace already configured',
  'Open the setup link from your server terminal':
    'Open the setup link from your server terminal',
  'HTTPS browser origin required': 'HTTPS browser origin required',
  'Invitation revocation takes no fields':
    'Invitation revocation takes no fields',
  'Request failed ({status}).': 'Request failed ({status}).',
  'Invalid request': 'Invalid request',
  'Invalid request body': 'Invalid request body',
  'REST API': 'REST API',
  'GraphQL API': 'GraphQL API',
  'Remove field {number}': 'Remove field {number}',
  'NODE SETTINGS': 'NODE SETTINGS',
  'BUILD SOMETHING USEFUL': 'BUILD SOMETHING USEFUL',
  'Connect the dots. Let your API do the work.':
    'Connect the dots. Let your API do the work.',
  'API key protected': 'API key protected',
  'Published endpoint URL': 'Published endpoint URL',
  'Flow canvas': 'Flow canvas',
  'New draft': 'New draft',
  'Try it out': 'Try it out',
  'WAITING FOR A RUN': 'WAITING FOR A RUN',
  'Use this API': 'Use this API',
  'Generated backend': 'Generated backend',
  'Your API starts here': 'Your API starts here',
  'Choose a path': 'Choose a path',
  'Send something back': 'Send something back',
  'Read selected columns': 'Read selected columns',
  'Read an uploaded copy': 'Read an uploaded copy',
  'Resolve a product identity': 'Resolve a product identity',
  'Data source': 'Data source',
  'Maximum rows': 'Maximum rows',
  'Filter rows': 'Filter rows',
  'Match one column': 'Match one column',
  'Match column': 'Match column',
  'Match value type': 'Match value type',
  'Fixed text': 'Fixed text',
  'Fixed number': 'Fixed number',
  'Match value': 'Match value',
  'Include {name}': 'Include {name}',
  'API field: {name}': 'API field: {name}',
  Language: 'Language',
  Appearance: 'Appearance',
  Light: 'Light',
  Dark: 'Dark',
  System: 'System',
  Members: 'Members',
  Updates: 'Updates',
  Workspace: 'Workspace',
  WORKSPACE: 'WORKSPACE',
  Save: 'Save',
  Cancel: 'Cancel',
  Close: 'Close',
  Refresh: 'Refresh',
  Search: 'Search',
  Request: 'Request',
  Response: 'Response',
  Email: 'Email',
  Password: 'Password',
  Invitations: 'Invitations',
  Favorites: 'Favorites',
  API: 'API',
  Logic: 'Logic',
  Data: 'Data',
  Condition: 'Condition',
  Draft: 'Draft',
  Saved: 'Saved',
  Publish: 'Publish',
  METHOD: 'METHOD',
  Comparison: 'Comparison',
  Equals: 'Equals',
  Text: 'Text',
  Number: 'Number',
  True: 'True',
  False: 'False',
  Field: 'Field',
  Body: 'Body',
  Query: 'Query',
  'Small steps. Powerful APIs.': 'Small steps. Powerful APIs.',
  'Build a flow you can understand, test, and trust.':
    'Build a flow you can understand, test, and trust.',
  owner: 'owner',
  editor: 'editor',
  viewer: 'viewer',
  'Unknown role': 'Unknown role',
  'Custom role': 'Custom role',
  'Loading saved source details…': 'Loading saved source details…',
  'No saved sources are available. Import a spreadsheet in Data sources, then return to this step.':
    'No saved sources are available. Import a spreadsheet in Data sources, then return to this step.',
  'No allowed sources are available. Ask the owner to review source USE for your selected APIs.':
    'No allowed sources are available. Ask the owner to review source USE for your selected APIs.',
  'Choose a saved source to configure this step.':
    'Choose a saved source to configure this step.',
  'Source details could not be loaded. Check the error above.':
    'Source details could not be loaded. Check the error above.',
  'Source access is required. Ask the owner to review your permissions and source USE.':
    'Source access is required. Ask the owner to review your permissions and source USE.',
  'No sources are available to this account. Ask the owner to provide a source.':
    'No sources are available to this account. Ask the owner to provide a source.',
  'Custom roles': 'Custom roles',
  'New role': 'New role',
  'Choose actions for this local workspace. Every member can manage their own account and sessions. Member and role administration stays with the owner.':
    'Choose actions for this local workspace. Every member can manage their own account and sessions. Member and role administration stays with the owner.',
  'Actions are separate: editing, testing, and publication each need their own grant. Reading related APIs or connections is needed to choose them in forms.':
    'Actions are separate: editing, testing, and publication each need their own grant. Reading related APIs or connections is needed to choose them in forms.',
  'Loading permission choices…': 'Loading permission choices…',
  'Retry permission choices': 'Retry permission choices',
  'Save changes to {name}? Changed grants apply immediately to member keys and end affected browser sessions. Review all selected permissions before continuing.':
    'Save changes to {name}? Changed grants apply immediately to member keys and end affected browser sessions. Review all selected permissions before continuing.',
  'Role updated. Changed grants end affected browser sessions.':
    'Role updated. Changed grants end affected browser sessions.',
  'Role created. Assign it to a member when ready.':
    'Role created. Assign it to a member when ready.',
  'Could not save role.': 'Could not save role.',
  'Edit {name} · version {version}': 'Edit {name} · version {version}',
  'Create custom role': 'Create custom role',
  'Role name': 'Role name',
  'No workspace action grants. Members with this role can still sign in and manage their own account.':
    'No workspace action grants. Members with this role can still sign in and manage their own account.',
  'Backup access exposes the entire workspace, including saved data and sensitive credential records. Keep downloads private.':
    'Backup access exposes the entire workspace, including saved data and sensitive credential records. Keep downloads private.',
  'Load testing repeatedly executes live APIs. Configured writes can change product data. Grant only to trusted operators.':
    'Load testing repeatedly executes live APIs. Configured writes can change product data. Grant only to trusted operators.',
  'Save role': 'Save role',
  'Cancel role changes': 'Cancel role changes',
  'If another owner session changes this role, refresh the members page and reopen the role before saving again.':
    'If another owner session changes this role, refresh the members page and reopen the role before saving again.',
  'Custom · v{version}': 'Custom · v{version}',
  'Account and own sessions only': 'Account and own sessions only',
  'Edit {name}': 'Edit {name}',
  'Delete role {name}? This cannot be undone. Roles assigned to members cannot be deleted.':
    'Delete role {name}? This cannot be undone. Roles assigned to members cannot be deleted.',
  'Role deleted.': 'Role deleted.',
  'Could not delete role.': 'Could not delete role.',
  'Delete {name}': 'Delete {name}',
  'No custom roles yet. Built-in owner, editor, and viewer roles stay available.':
    'No custom roles yet. Built-in owner, editor, and viewer roles stay available.',
  'Read APIs': 'Read APIs',
  'Edit APIs': 'Edit APIs',
  'Test drafts': 'Test drafts',
  'Publish and roll back': 'Publish and roll back',
  'Read data sources': 'Read data sources',
  'Manage data sources': 'Manage data sources',
  'Read database copies': 'Read database copies',
  'Manage database copies': 'Manage database copies',
  'Read product login connections': 'Read product login connections',
  'Manage product login connections': 'Manage product login connections',
  'Manage runtime API keys': 'Manage runtime API keys',
  'Read audit history': 'Read audit history',
  'Manage workspace backups': 'Manage workspace backups',
  'Read migration history': 'Read migration history',
  'Run load tests': 'Run load tests',
  APIs: 'APIs',
  Databases: 'Databases',
  Security: 'Security',
  'Read authorized API drafts, release history, OpenAPI documents, client examples, and generated backend source.':
    'Read authorized API drafts, release history, OpenAPI documents, client examples, and generated backend source.',
  'Create and save API drafts. Selected access permits editing existing shared APIs with explicit dependency use, but cannot create APIs.':
    'Create and save API drafts. Selected access permits editing existing shared APIs with explicit dependency use, but cannot create APIs.',
  'Execute saved REST and GraphQL drafts, including their configured data and product-login steps. Selected access also requires explicit dependency use.':
    'Execute saved REST and GraphQL drafts, including their configured data and product-login steps. Selected access also requires explicit dependency use.',
  'Change live API behavior by publishing drafts or rolling back releases.':
    'Change live API behavior by publishing drafts or rolling back releases.',
  'Read source metadata and saved rows.':
    'Read source metadata and saved rows.',
  'Import, replace, refresh, and delete sources. Replacing data changes what published APIs read.':
    'Import, replace, refresh, and delete sources. Replacing data changes what published APIs read.',
  'Read uploaded SQLite copy metadata and selected rows. Generated APIs may expose their configured data.':
    'Read uploaded SQLite copy metadata and selected rows. Generated APIs may expose their configured data.',
  'Upload, check, and delete immutable SQLite copies. Workspace backups include all uploaded data.':
    'Upload, check, and delete immutable SQLite copies. Workspace backups include all uploaded data.',
  'Read product-login connection metadata without provider secrets.':
    'Read product-login connection metadata without provider secrets.',
  'Create, update, and delete server-held provider credentials. Changes affect live product login.':
    'Create, update, and delete server-held provider credentials. Changes affect live product login.',
  'Issue, list, replace, and revoke runtime keys. Selected access manages issuer-bound keys for shared APIs; issuance and replacement require dependency use and preserve release pins.':
    'Issue, list, replace, and revoke runtime keys. Selected access manages issuer-bound keys for shared APIs; issuance and replacement require dependency use and preserve release pins.',
  'Read workspace activity and security events.':
    'Read workspace activity and security events.',
  'Create, list, and download complete workspace backups containing saved data and sensitive credential records.':
    'Create, list, and download complete workspace backups containing saved data and sensitive credential records.',
  'Read the control database migration history.':
    'Read the control database migration history.',
  'List published targets and load-test history; start and cancel bounded local runs. Runs execute published APIs and may cause their configured writes.':
    'List published targets and load-test history; start and cancel bounded local runs. Runs execute published APIs and may cause their configured writes.',
  'Your team': 'Your team',
  'WORKSPACE CONTROL': 'WORKSPACE CONTROL',
  'Member keys manage the workspace. Use API keys for published endpoint callers.':
    'Member keys manage the workspace. Use API keys for published endpoint callers.',
  'Loading workspace records…': 'Loading workspace records…',
  'Only the owner can manage members and roles.':
    'Only the owner can manage members and roles.',
  'Refresh Members and review an active tenant before creating this member.':
    'Refresh Members and review an active tenant before creating this member.',
  'Create {name} with assigned tenant {tenant}? Protected API actions derive this identity. API permissions and dependency USE remain separate. This assignment and member credential are created together.':
    'Create {name} with assigned tenant {tenant}? Protected API actions derive this identity. API permissions and dependency USE remain separate. This assignment and member credential are created together.',
  'Member created. Save their token; it is shown once.':
    'Member created. Save their token; it is shown once.',
  Name: 'Name',
  'Member name': 'Member name',
  Role: 'Role',
  'Member role': 'Member role',
  'Member email (optional)': 'Member email (optional)',
  'Member password': 'Member password',
  '12 to 128 characters. Leave email blank for key-only access.':
    '12 to 128 characters. Leave email blank for key-only access.',
  'New member API access': 'New member API access',
  'New member tenant': 'New member tenant',
  'No tenant assigned': 'No tenant assigned',
  'Optional initial assignment. Review before adding the member; no separate credential creation and reassignment occurs.':
    'Optional initial assignment. Review before adding the member; no separate credential creation and reassignment occurs.',
  'Add member': 'Add member',
  'Save this member token': 'Save this member token',
  'New member token': 'New member token',
  'Member token copied.': 'Member token copied.',
  Copy: 'Copy',
  'I saved it': 'I saved it',
  'Opening invitations…': 'Opening invitations…',
  'API access': 'API access',
  'Tenant identity': 'Tenant identity',
  'Invite sign-in': 'Invite sign-in',
  'Bootstrap owner': 'Bootstrap owner',
  'Revoke access for {name}?': 'Revoke access for {name}?',
  'Member access revoked.': 'Member access revoked.',
  'Start with your spreadsheet, or build a blank API using the request and response below. Opening either path does not save or publish an API. You choose when to create or save its draft.':
    'Start with your spreadsheet, or build a blank API using the request and response below. Opening either path does not save or publish an API. You choose when to create or save its draft.',
  'Your next idea starts here.': 'Your next idea starts here.',
  'Create your first API.': 'Create your first API.',
  'Selected APIs · {count}': 'Selected APIs · {count}',
  'Manage APIs for {name}': 'Manage APIs for {name}',
  'Owner access cannot be restricted.': 'Owner access cannot be restricted.',
  'Owner reviews a tenant for each protected action.':
    'Owner reviews a tenant for each protected action.',
  'Assigned tenant': 'Assigned tenant',
  'Manage tenant for {name}': 'Manage tenant for {name}',
  'Viewer · read APIs': 'Viewer · read APIs',
  'Editor · build and test': 'Editor · build and test',
  '{name} · custom role': '{name} · custom role',
  'Role for {name}': 'Role for {name}',
  "Change {name}'s role from {current} to {next}? This ends their active browser sessions. Their member key immediately uses the new permissions.":
    "Change {name}'s role from {current} to {next}? This ends their active browser sessions. Their member key immediately uses the new permissions.",
  'Member role updated. Their browser sessions were ended.':
    'Member role updated. Their browser sessions were ended.',
  'Could not update member role.': 'Could not update member role.',
  'Change role': 'Change role',
  'Selected APIs only': 'Selected APIs only',
  'Selected sharing limits API scope. Use Viewer or a custom role with only API, runtime-key and load-test actions. Actions still require separate role grants. It grants no API creation or global resource management.':
    'Selected sharing limits API scope. Use Viewer or a custom role with only API, runtime-key and load-test actions. Actions still require separate role grants. It grants no API creation or global resource management.',
  'This role has actions beyond Read APIs and selected API operations. Choose an eligible custom role or Viewer, or explicitly select All APIs before continuing.':
    'This role has actions beyond Read APIs and selected API operations. Choose an eligible custom role or Viewer, or explicitly select All APIs before continuing.',
  'Choose APIs to share': 'Choose APIs to share',
  'Share {name}': 'Share {name}',
  '{count} APIs selected.': '{count} APIs selected.',
  'No APIs selected. This member can sign in, but sees no APIs.':
    'No APIs selected. This member can sign in, but sees no APIs.',
  'Dependencies these APIs may use': 'Dependencies these APIs may use',
  'USE permits these selected APIs to read chosen dependency data or trigger product login when the role allows testing, publishing or callers. It can expose stored data through the API. It grants no dependency preview or management. Row, column and tenant authorization remain separate; selecting APIs or dependencies does not provide them.':
    'USE permits these selected APIs to read chosen dependency data or trigger product login when the role allows testing, publishing or callers. It can expose stored data through the API. It grants no dependency preview or management. Row, column and tenant authorization remain separate; selecting APIs or dependencies does not provide them.',
  'Use spreadsheet sources': 'Use spreadsheet sources',
  'Use SQLite copies': 'Use SQLite copies',
  'Use product login connections': 'Use product login connections',
  'Use spreadsheet {name}': 'Use spreadsheet {name}',
  'Use SQLite copy {name}': 'Use SQLite copy {name}',
  'Use product login {name}': 'Use product login {name}',
  'Structure only · version {version}': 'Structure only · version {version}',
  'No saved dependencies in this group.':
    'No saved dependencies in this group.',
  '{count} dependencies allowed for USE.':
    '{count} dependencies allowed for USE.',
  'All current and future APIs. Actions still follow the assigned role.':
    'All current and future APIs. Actions still follow the assigned role.',
  'Live · v{version}': 'Live · v{version}',
  'Saved · revision {revision}': 'Saved · revision {revision}',
  '{nodes} nodes · {connections} connections':
    '{nodes} nodes · {connections} connections',
  'Use /v1/customers/:id for a versioned route with a path parameter. Each :name occupies a whole route segment.':
    'Use /v1/customers/:id for a versioned route with a path parameter. Each :name occupies a whole route segment.',
  'Owner and member keys manage drafts. Create an API key in API keys to call a published endpoint.':
    'Owner and member keys manage drafts. Create an API key in API keys to call a published endpoint.',
  'REQUEST DETAILS': 'REQUEST DETAILS',
  '// Save your draft, then run a test.\n// Your response will appear here.':
    '// Save your draft, then run a test.\n// Your response will appear here.',
  'Discard unsaved draft changes?': 'Discard unsaved draft changes?',
}

export default messages
