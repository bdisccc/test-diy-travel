import { NAVIGATION_STATE_KEY } from './tripData.js'

export function loadNavigationState() {
  try {
    const saved = JSON.parse(localStorage.getItem(NAVIGATION_STATE_KEY) || '{}')
    const active = ['plan', 'today', 'budget', 'checklist'].includes(saved.active) ? saved.active : 'plan'
    return {
      active,
      planScreen: saved.planScreen === 'editor' ? 'editor' : 'dashboard',
      moduleScreen: saved.moduleScreen === 'detail' ? 'detail' : 'dashboard',
    }
  } catch {
    return { active: 'plan', planScreen: 'dashboard', moduleScreen: 'dashboard' }
  }
}

