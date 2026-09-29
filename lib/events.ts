import type { NavProject } from '@/actions/projects'

export const PROJECTS_CHANGED_EVENT = 'pir-projects-changed'
export const ORG_CHANGED_EVENT = 'pir-org-changed'

/**
 * Dispatches a client-side event to notify UI components (like AppSidebar)
 * that the list of projects has been updated, created, or archived.
 */
export function notifyProjectsChanged(newProject?: NavProject) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<NavProject | undefined>(PROJECTS_CHANGED_EVENT, {
        detail: newProject,
      })
    )
  }
}

/**
 * Dispatches a client-side event to notify UI components (OrgSwitcher, AppSidebar, TopNavBar)
 * that active organization or organization membership has changed.
 */
export function notifyOrgChanged(orgId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<{ orgId?: string }>(ORG_CHANGED_EVENT, {
        detail: { orgId },
      })
    )
  }
}
