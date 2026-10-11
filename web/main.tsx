import './lib/schema'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/app'
import { initializeLanguage } from './i18n'
import './styles.css'

let invitationToken: string | undefined
let invitationBootstrapComplete = false

function captureInvitation() {
  const fragment = new URLSearchParams(location.hash.slice(1))
  if (!fragment.has('invite')) return
  invitationToken = fragment.get('invite') ?? ''
  history.replaceState(null, '', `${location.pathname}${location.search}`)
}

window.addEventListener('hashchange', captureInvitation)
captureInvitation()

function completeInvitationBootstrap() {
  if (invitationBootstrapComplete) return undefined
  invitationBootstrapComplete = true
  captureInvitation()
  window.removeEventListener('hashchange', captureInvitation)
  const token = invitationToken
  invitationToken = undefined
  return token
}

void initializeLanguage().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App
        invitationToken={invitationToken}
        completeInvitationBootstrap={completeInvitationBootstrap}
      />
    </StrictMode>,
  )
})
