import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertCircle, ArrowDownUp, ArrowRight, Bell, Check,
  ChevronDown, CircleHelp, Clock3, Command, Filter, LayoutDashboard,
  ListTodo, LoaderCircle, LogOut, Menu, Plus, Search, Settings,
  ShieldCheck, Users, X, Zap, UserRound, RefreshCw,
} from 'lucide-react'
import './App.css'

type Status =
  | 'open'
  | 'in_progress'
  | 'blocked'
  | 'awaiting_approval'
  | 'resolved'
  | 'closed'

type Priority = 'low' | 'medium' | 'high' | 'critical'

type WorkItem = {
  id: number
  title: string
  description?: string | null
  status: Status
  priority: Priority
  team_id: number
  assignee_id?: number | null
  version: number
  created_at?: string
  updated_at?: string
}

type TeamMember = { id: number; name: string; email: string; role: string }
type Team = { id: number; name: string; created_at?: string; member_count: number; work_item_count: number }
type ActivityEvent = { id: number; work_item_id: number; work_item_title: string; actor_id: number; actor_name: string; action: string; details: Record<string, unknown>; created_at: string }
const authHeaders = { Authorization: 'Bearer admin-token' }
const statuses: Status[] = [
  'open', 'in_progress', 'blocked', 'awaiting_approval', 'resolved', 'closed',
]

const allowedTransitions: Record<Status, Status[]> = {
  open: ['in_progress', 'blocked', 'closed'],
  in_progress: ['blocked', 'awaiting_approval', 'resolved', 'open'],
  blocked: ['in_progress', 'open'],
  awaiting_approval: ['resolved', 'in_progress'],
  resolved: ['closed', 'in_progress'],
  closed: [],
}

const statusLabel: Record<Status, string> = {
  open: 'Open',
  in_progress: 'In progress',
  blocked: 'Blocked',
  awaiting_approval: 'Awaiting approval',
  resolved: 'Resolved',
  closed: 'Closed',
}

const priorityLabel: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Work items', icon: ListTodo },
  { label: 'Teams', icon: Users },
  { label: 'Activity', icon: Activity },
]

function App() {
  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [activeNav, setActiveNav] = useState('Overview')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [assigneeId, setAssigneeId] = useState('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [nextStatus, setNextStatus] = useState<Status | ''>('')
  const [teams, setTeams] = useState<Team[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamsError, setTeamsError] = useState('')
  const [membersByTeam, setMembersByTeam] = useState<Record<number, TeamMember[]>>({})
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [signedOut, setSignedOut] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/work-items', {
        headers: { Authorization: 'Bearer admin-token' },
      })

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? 'Authentication failed. Check the local demo token configuration.'
            : `The server returned HTTP ${response.status}.`,
        )
      }

      const data: unknown = await response.json()
      const rows = Array.isArray(data)
        ? data
        : data && typeof data === 'object' && 'items' in data
          ? (data as { items: unknown }).items
          : null

      if (!Array.isArray(rows)) {
        throw new Error('Unexpected API response. Check the work-items endpoint.')
      }

      setItems(rows as WorkItem[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not connect to the backend.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const openItem = async (itemId: number) => {
  setSelectedItem(null)
  setDetailLoading(true)
  setDetailError('')
  setNextStatus('')

  try {
    const response = await fetch(`/work-items/${itemId}`, {
      headers: { Authorization: 'Bearer admin-token' },
    })

    if (!response.ok) {
      throw new Error(`Could not load work item (HTTP ${response.status}).`)
    }

    const item = (await response.json()) as WorkItem
    setSelectedItem(item)
    setNextStatus(item.status)
  } catch (err) {
    setDetailError(
      err instanceof Error ? err.message : 'Could not load work item.',
    )
  } finally {
    setDetailLoading(false)
  }
}

const updateItemStatus = async () => {
  if (!selectedItem || !nextStatus || nextStatus === selectedItem.status) {
    return
  }

  setDetailSaving(true)
  setDetailError('')

  try {
    const response = await fetch(`/work-items/${selectedItem.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        expected_version: selectedItem.version,
        status: nextStatus,
      }),
    })

    const body = await response.json().catch(() => null)

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error(
          typeof body?.detail === 'string'
            ? `${body.detail} Reopen this item to load the latest version.`
            : 'Conflict detected. Reopen this item and retry.',
        )
      }

      throw new Error(
        typeof body?.detail === 'string'
          ? body.detail
          : `Update failed (HTTP ${response.status}).`,
      )
    }

    const updatedItem = body as WorkItem
    setSelectedItem(updatedItem)
    setNextStatus(updatedItem.status)
    await loadItems()
  } catch (err) {
    setDetailError(
      err instanceof Error ? err.message : 'Could not update work item.',
    )
  } finally {
    setDetailSaving(false)
  }
}

  const loadTeams = useCallback(async () => {
    setTeamsLoading(true); setTeamsError('')
    try {
      const response = await fetch('/teams', { headers: authHeaders })
      if (!response.ok) throw new Error(`Could not load teams (HTTP ${response.status}).`)
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new Error('Unexpected teams API response.')
      setTeams(data as Team[])
    } catch (err) { setTeamsError(err instanceof Error ? err.message : 'Could not load teams.') }
    finally { setTeamsLoading(false) }
  }, [])

  const loadActivity = useCallback(async () => {
    setActivityLoading(true); setActivityError('')
    try {
      const response = await fetch('/activity?limit=30', { headers: authHeaders })
      if (!response.ok) throw new Error(`Could not load activity (HTTP ${response.status}).`)
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new Error('Unexpected activity API response.')
      setActivity(data as ActivityEvent[])
    } catch (err) { setActivityError(err instanceof Error ? err.message : 'Could not load activity.') }
    finally { setActivityLoading(false) }
  }, [])

  const loadTeamMembersFor = async (teamId: number) => {
    if (membersByTeam[teamId]) { setExpandedTeam(expandedTeam === teamId ? null : teamId); return }
    try {
      const response = await fetch(`/teams/${teamId}/members`, { headers: authHeaders })
      if (!response.ok) throw new Error(`Could not load members (HTTP ${response.status}).`)
      const data = await response.json()
      setMembersByTeam((current) => ({ ...current, [teamId]: data as TeamMember[] }))
      setExpandedTeam(teamId)
    } catch (err) { setTeamsError(err instanceof Error ? err.message : 'Could not load team members.') }
  }

  useEffect(() => { if (activeNav === 'Teams') void loadTeams() }, [activeNav, loadTeams])
  useEffect(() => { if (activeNav === 'Overview' || activeNav === 'Activity' || notificationsOpen) void loadActivity() }, [activeNav, notificationsOpen, loadActivity])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  useEffect(() => {
    if (!showCreate) return

    let cancelled = false

    async function loadTeamMembers() {
      setMembersLoading(true)
      setMembersError('')

      try {
        const response = await fetch(
          '/work-items/team-members?team_id=1',
          {
            headers: {
              Authorization: 'Bearer admin-token',
            },
          },
        )

        if (!response.ok) {
          throw new Error(
            `Could not load team members (HTTP ${response.status}).`,
          )
        }

        const data: unknown = await response.json()

        if (
          !Array.isArray(data) ||
          !data.every(
            (member) =>
              member !== null &&
              typeof member === 'object' &&
              'id' in member &&
              'name' in member &&
              'email' in member &&
              'role' in member &&
              typeof member.id === 'number' &&
              typeof member.name === 'string' &&
              typeof member.email === 'string' &&
              typeof member.role === 'string',
          )
        ) {
          throw new Error('Unexpected team-members API response.')
        }

        if (!cancelled) {
          setTeamMembers(data as TeamMember[])
        }
      } catch (err) {
        if (!cancelled) {
          setMembersError(
            err instanceof Error
              ? err.message
              : 'Could not load team members.',
          )
        }
      } finally {
        if (!cancelled) {
          setMembersLoading(false)
        }
      }
    }

    void loadTeamMembers()

    return () => {
      cancelled = true
    }
  }, [showCreate])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        String(item.id).includes(query) ||
        (item.description ?? '').toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'all' ||
        item.status === statusFilter ||
        (statusFilter === 'resolved_closed' &&
          (item.status === 'resolved' || item.status === 'closed'))

      return (
        matchesSearch &&
        matchesStatus &&
        (priorityFilter === 'all' || item.priority === priorityFilter)
      )
    })
  }, [items, search, statusFilter, priorityFilter])

  const counts = useMemo(() => ({
    open: items.filter((item) => item.status === 'open').length,
    active: items.filter((item) => item.status === 'in_progress').length,
    blocked: items.filter((item) => item.status === 'blocked').length,
    resolved: items.filter(
      (item) => item.status === 'resolved' || item.status === 'closed',
    ).length,
    critical: items.filter(
      (item) => item.priority === 'critical' &&
        item.status !== 'resolved' && item.status !== 'closed',
    ).length,
  }), [items])

  const statusBreakdown = useMemo(() => ([
    { status: 'open' as Status, label: 'Open', value: items.filter((item) => item.status === 'open').length, color: '#7da2ff' },
    { status: 'in_progress' as Status, label: 'In progress', value: items.filter((item) => item.status === 'in_progress').length, color: '#b39aff' },
    { status: 'blocked' as Status, label: 'Blocked', value: items.filter((item) => item.status === 'blocked').length, color: '#ffad7d' },
    { status: 'awaiting_approval' as Status, label: 'Awaiting approval', value: items.filter((item) => item.status === 'awaiting_approval').length, color: '#e8cf8a' },
    { status: 'resolved' as Status, label: 'Resolved', value: items.filter((item) => item.status === 'resolved').length, color: '#70d7b0' },
    { status: 'closed' as Status, label: 'Closed', value: items.filter((item) => item.status === 'closed').length, color: '#4ca98b' },
  ]), [items])

  const priorityBreakdown = useMemo(() => ([
    { priority: 'critical' as Priority, label: 'Critical', value: items.filter((item) => item.priority === 'critical').length, color: '#ff8291' },
    { priority: 'high' as Priority, label: 'High', value: items.filter((item) => item.priority === 'high').length, color: '#ffad7d' },
    { priority: 'medium' as Priority, label: 'Medium', value: items.filter((item) => item.priority === 'medium').length, color: '#e8cf8a' },
    { priority: 'low' as Priority, label: 'Low', value: items.filter((item) => item.priority === 'low').length, color: '#7da2ff' },
  ]), [items])

  const statusGradient = useMemo(() => {
    if (items.length === 0) return 'conic-gradient(#263449 0% 100%)'
    let cursor = 0
    const slices = statusBreakdown.map((entry) => {
      const start = cursor
      cursor += (entry.value / items.length) * 100
      return `${entry.color} ${start}% ${cursor}%`
    })
    return `conic-gradient(${slices.join(', ')})`
  }, [items.length, statusBreakdown])

  const handleSummaryCardClick = (filter: string) => {
    setActiveNav('Work items')
    setStatusFilter(filter)
    setPriorityFilter('all')
    setSearch('')
    setMobileNavOpen(false)
  }

  async function createItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setCreateError('')

    try {
      const response = await fetch('/work-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          team_id: 1,
          assignee_id: assigneeId ? Number(assigneeId) : null,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const detail =
          body && typeof body.detail === 'string'
            ? body.detail
            : `Could not create work item (HTTP ${response.status}).`
        throw new Error(detail)
      }

      setTitle('')
      setDescription('')
      setPriority('medium')
      setAssigneeId('')
      setShowCreate(false)
      await loadItems()
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Could not create the work item.',
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="app-shell">
      {mobileNavOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark"><Zap size={22} fill="currentColor" /></span>
          <span className="brand-name">opsflow<span>.</span></span>
        </a>

        <div className="workspace-switcher">
          <div className="workspace-avatar">O</div>
          <div className="workspace-copy">
            <strong>Operations</strong>
            <span>Workspace</span>
          </div>
        </div>

        <p className="nav-heading">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-link ${activeNav === label ? 'nav-link-active' : ''}`}
              onClick={() => {
                setActiveNav(label)
                setMobileNavOpen(false)
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === 'Work items' && (
                <span className="nav-count">{items.length}</span>
              )}
            </button>
          ))}
        </nav>

        <p className="nav-heading nav-heading-spaced">PREFERENCES</p>
        <nav className="main-nav">
          <button className={`nav-link ${activeNav === 'Settings' ? 'nav-link-active' : ''}`} onClick={() => setActiveNav('Settings')}>
            <Settings size={18} strokeWidth={1.8} />
            <span>Settings</span>
          </button>
          <button className={`nav-link ${activeNav === 'Help' ? 'nav-link-active' : ''}`} onClick={() => setActiveNav('Help')}>
            <CircleHelp size={18} strokeWidth={1.8} />
            <span>Help & support</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><ShieldCheck size={19} /></div>
            <strong>Your workspace</strong>
            <p>Keep your team’s work moving with clear ownership.</p>
          </div>
          <div className="profile-row">
            <div className="profile-avatar">AD</div>
            <div className="profile-copy">
              <strong>Workspace Admin</strong>
              <span>Administrator</span>
            </div>
            <button className="icon-button profile-logout" title="Account" aria-label="Open profile" onClick={() => setProfileOpen((open) => !open)}><UserRound size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span><span className="crumb-separator">/</span>
            <strong>{activeNav}</strong>
          </div>
          <div className="topbar-actions">
            <div className="command-hint"><Command size={13} /> <span>K</span></div>
            <button className="icon-button notification-button" aria-label="Notifications" title="Notifications" onClick={() => { setNotificationsOpen((open) => !open); setProfileOpen(false) }}><Bell size={18} />{activity.length > 0 && <span className="notification-dot" />}</button>
            <div className="topbar-divider" />
            <button className="profile-avatar top-avatar profile-trigger" aria-label="Open profile" onClick={() => { setProfileOpen((open) => !open); setNotificationsOpen(false) }}>AD</button>
          </div>
        </header>

        {notificationsOpen && <div className="floating-panel notification-panel"><div className="floating-heading"><strong>Recent activity</strong><button className="text-button" onClick={() => void loadActivity()}><RefreshCw size={13} /> Refresh</button></div>{activityLoading ? <p className="panel-muted">Loading recent activity…</p> : activityError ? <p className="panel-error">{activityError}</p> : activity.length === 0 ? <p className="panel-muted">No activity recorded yet.</p> : activity.slice(0, 5).map((event) => <button className="notification-entry" key={event.id} onClick={() => { setNotificationsOpen(false); setActiveNav('Activity'); void openItem(event.work_item_id) }}><span className="activity-mini-icon"><Activity size={15} /></span><span><strong>{event.actor_name}</strong> {event.action} <b>{event.work_item_title}</b><small>{new Date(event.created_at).toLocaleString()}</small></span></button>)}<button className="secondary-button panel-full-button" onClick={() => { setNotificationsOpen(false); setActiveNav('Activity') }}>View all activity</button></div>}
        {profileOpen && <div className="floating-panel profile-panel"><div className="profile-panel-user"><div className="profile-avatar">AD</div><div><strong>Workspace Admin</strong><span>Demo administrator</span></div></div><p className="panel-muted">OpsFlow local demo session</p><button className="secondary-button panel-full-button" onClick={() => { setProfileOpen(false); setSignedOut(true) }}><LogOut size={15} /> Sign out of demo</button></div>}
        {signedOut && <div className="modal-backdrop"><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="signout-title"><div className="modal-heading"><div><span className="eyebrow">DEMO SESSION</span><h2 id="signout-title">Signed out of demo</h2><p>This demo uses a fixed local token, not a production login session.</p></div></div><div className="modal-actions"><button className="primary-button" onClick={() => setSignedOut(false)}>Return to OpsFlow demo</button></div></section></div>}

        <div className="page-content">
          {activeNav === 'Teams' ? <>
            <section className="page-heading"><div><div className="eyebrow"><span className="live-dot" /> WORKSPACE DIRECTORY</div><h1>Teams</h1><p className="page-subtitle">Explore teams, membership, and workload from live workspace data.</p></div><button className="secondary-button" onClick={() => void loadTeams()}><RefreshCw size={15} /> Refresh teams</button></section>
            {teamsError && <div className="error-banner" role="alert"><AlertCircle size={18}/><div><strong>Teams unavailable</strong><p>{teamsError}</p></div><button className="secondary-button" onClick={() => void loadTeams()}>Retry</button></div>}
            {teamsLoading ? <div className="workspace-panel panel-empty"><LoaderCircle className="spin"/> Loading teams…</div> : teams.length === 0 ? <div className="workspace-panel panel-empty"><Users size={24}/><strong>No teams found</strong><span>No accessible teams were returned by the API.</span></div> : <div className="teams-grid">{teams.map(team => <article className="workspace-panel team-card" key={team.id}><div className="team-card-top"><div className="team-avatar"><Users size={20}/></div><span className="team-id">TEAM #{team.id}</span></div><h2>{team.name}</h2><div className="team-stats"><div><strong>{team.member_count}</strong><span>Members</span></div><div><strong>{team.work_item_count}</strong><span>Work items</span></div></div><button className="secondary-button" onClick={() => void loadTeamMembersFor(team.id)}>{expandedTeam === team.id ? 'Hide members' : 'View members'} <ArrowRight size={14}/></button>{expandedTeam === team.id && <div className="team-members">{(membersByTeam[team.id] || []).length === 0 ? <span className="panel-muted">No active members in this team.</span> : (membersByTeam[team.id] || []).map(member => <div className="team-member" key={member.id}><div className="profile-avatar member-avatar">{member.name.split(/\s+/).map(part => part[0]).slice(0,2).join('').toUpperCase()}</div><div><strong>{member.name}</strong><span>{member.email}</span></div><span className="role-badge">{member.role}</span></div>)}</div>}</article>)}</div>}
          </> : activeNav === 'Activity' ? <>
            <section className="page-heading"><div><div className="eyebrow"><span className="live-dot" /> AUDIT TRAIL</div><h1>Activity</h1><p className="page-subtitle">A chronological record of actions captured by OpsFlow.</p></div><button className="secondary-button" onClick={() => void loadActivity()}><RefreshCw size={15}/> Refresh activity</button></section>
            {activityError && <div className="error-banner" role="alert"><AlertCircle size={18}/><div><strong>Activity unavailable</strong><p>{activityError}</p></div><button className="secondary-button" onClick={() => void loadActivity()}>Retry</button></div>}
            <section className="workspace-panel activity-panel"><div className="section-heading"><div><div className="section-title-row"><h2>Recent events</h2><span className="section-count">{activity.length}</span></div><p className="section-subtitle">Events recorded by the backend audit log.</p></div></div>{activityLoading ? <div className="panel-empty"><LoaderCircle className="spin"/> Loading activity…</div> : activity.length === 0 ? <div className="panel-empty"><Activity size={24}/><strong>No activity yet</strong><span>Create or update a work item to record the first event.</span></div> : <div className="activity-list">{activity.map(event => <article className="activity-row" key={event.id}><div className="activity-node"><Activity size={16}/></div><div className="activity-body"><div><strong>{event.actor_name}</strong> <span>{event.action}</span> <button className="inline-link" onClick={() => void openItem(event.work_item_id)}>{event.work_item_title}</button></div><p>{event.action === 'created' ? 'Created this work item.' : event.details?.changes ? `Updated: ${Object.keys(event.details.changes as object).join(', ')}` : 'Updated this work item.'}</p><time>{new Date(event.created_at).toLocaleString()}</time></div><button className="row-action" aria-label={`Open ${event.work_item_title}`} onClick={() => void openItem(event.work_item_id)}><ArrowRight size={16}/></button></article>)}</div>}</section>
          </> : activeNav === 'Settings' ? <><section className="page-heading"><div><div className="eyebrow">WORKSPACE PREFERENCES</div><h1>Settings</h1><p className="page-subtitle">Current local demo configuration.</p></div></section><section className="workspace-panel settings-panel"><div className="settings-row"><div><strong>Workspace</strong><span>Operations</span></div><span className="role-badge">Local demo</span></div><div className="settings-row"><div><strong>Authentication</strong><span>Fixed demo bearer token; not production identity management.</span></div><ShieldCheck size={18}/></div><div className="settings-row"><div><strong>API connection</strong><span>FastAPI backend through the Vite development proxy.</span></div><span className="status-badge status-resolved">Configured</span></div></section></> : activeNav === 'Help' ? <><section className="page-heading"><div><div className="eyebrow">OPSFlow GUIDE</div><h1>Help & support</h1><p className="page-subtitle">Quick guidance for the local challenge demo.</p></div></section><section className="workspace-panel help-panel"><h2>Working with OpsFlow</h2><div className="help-item"><strong>Create work</strong><p>Use New work item to create an item, set its priority, and optionally assign a team member.</p></div><div className="help-item"><strong>Update status</strong><p>Open a work item, select an allowed next status, and save. Conflicting edits require refreshing the item.</p></div><div className="help-item"><strong>Review history</strong><p>Use Activity and Notifications to inspect events recorded by the backend.</p></div><p className="panel-muted">This challenge build uses demo authentication and is not intended for production use.</p></section></> : <>
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="live-dot" /> OPERATIONS CENTER</div>
              <h1>{activeNav === 'Overview' ? 'Good evening' : 'Work items'}</h1>
              <p className="page-subtitle">
                {activeNav === 'Overview' ? 'Here’s what’s happening across your workspace today.' : 'Find, prioritize, and move work forward.'}
              </p>
            </div>
            <button className="primary-button" onClick={() => {
              setCreateError('')
              setShowCreate(true)
            }}>
              <Plus size={17} /> New work item
            </button>
          </section>

          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <div>
                <strong>Couldn’t load work items</strong>
                <p>{error} Make sure FastAPI is running on port 8000.</p>
              </div>
              <button className="secondary-button" onClick={() => void loadItems()}>
                Retry
              </button>
            </div>
          )}

          <section className="stats-grid" aria-label="Work item summary">
            <article
              className="stat-card stat-card-featured"
              role="button"
              tabIndex={0}
              aria-label="View open work items"
              onClick={() => handleSummaryCardClick('open')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSummaryCardClick('open')
                }
              }}
            >
              <div className="stat-top">
                <span className="stat-label">Open work items</span>
                <span className="stat-icon stat-icon-blue"><ListTodo size={18} /></span>
              </div>
              <div className="stat-number">{loading ? '—' : counts.open}</div>
              <div className="stat-foot"><span className="stat-foot-muted">Awaiting action</span></div>
              <div className="stat-decoration" />
            </article>
            <article
              className="stat-card"
              role="button"
              tabIndex={0}
              aria-label="View in-progress work items"
              onClick={() => handleSummaryCardClick('in_progress')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSummaryCardClick('in_progress')
                }
              }}
            >
              <div className="stat-top">
                <span className="stat-label">In progress</span>
                <span className="stat-icon stat-icon-purple"><Activity size={18} /></span>
              </div>
              <div className="stat-number">{loading ? '—' : counts.active}</div>
              <div className="stat-foot"><span className="stat-foot-muted">Currently being worked on</span></div>
            </article>
            <article
              className="stat-card"
              role="button"
              tabIndex={0}
              aria-label="View blocked work items"
              onClick={() => handleSummaryCardClick('blocked')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSummaryCardClick('blocked')
                }
              }}
            >
              <div className="stat-top">
                <span className="stat-label">Blocked</span>
                <span className="stat-icon stat-icon-orange"><AlertCircle size={18} /></span>
              </div>
              <div className="stat-number">{loading ? '—' : counts.blocked}</div>
              <div className="stat-foot"><span className="stat-foot-muted">Need attention</span></div>
            </article>
            <article
              className="stat-card"
              role="button"
              tabIndex={0}
              aria-label="View resolved and closed work items"
              onClick={() => handleSummaryCardClick('resolved_closed')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSummaryCardClick('resolved_closed')
                }
              }}
            >
              <div className="stat-top">
                <span className="stat-label">Resolved / closed</span>
                <span className="stat-icon stat-icon-green"><Check size={18} /></span>
              </div>
              <div className="stat-number">{loading ? '—' : counts.resolved}</div>
              <div className="stat-foot"><span className="stat-foot-muted">Completed work</span></div>
            </article>
          </section>

          <section className="insight-strip">
            <div className="insight-leading"><span className="insight-spark"><Zap size={16} fill="currentColor" /></span></div>
            <div className="insight-copy">
              <strong>{loading ? 'Checking your workspace…' :
                counts.critical > 0
                  ? `${counts.critical} critical ${counts.critical === 1 ? 'item needs' : 'items need'} attention`
                  : 'Your workspace at a glance'}</strong>
              <span>{loading ? 'Fetching the latest work items from the server.' :
                counts.critical > 0
                  ? 'Review critical work items and confirm their next action.'
                  : `${items.length} work item${items.length === 1 ? '' : 's'} loaded from your workspace.`}</span>
            </div>
            <div className="insight-right"><span className="insight-status-dot" /> Live data</div>
          </section>

          {activeNav === 'Work items' ? (
          <section className="work-section">
            <div className="section-heading">
              <div>
                <div className="section-title-row">
                  <h2>Work queue</h2>
                  <span className="section-count">{filteredItems.length}</span>
                </div>
                <p className="section-subtitle">Track ownership, priority, and progress.</p>
              </div>
              <button className="text-button" onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setPriorityFilter('all')
              }}>
                Reset filters <ArrowRight size={15} />
              </button>
            </div>

            <div className="queue-toolbar">
              <label className="search-box">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search work items..."
                  aria-label="Search work items"
                />
                {search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}
              </label>
              <label className="select-wrap">
                <Filter size={15} />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
                  <option value="all">All statuses</option>
                  <option value="resolved_closed">Resolved / closed</option>
                  {statuses.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="select-wrap">
                <ArrowDownUp size={15} />
                <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Filter by priority">
                  <option value="all">All priorities</option>
                  {(['critical', 'high', 'medium', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{priorityLabel[p]}</option>)}
                </select>
                <ChevronDown size={14} />
              </label>
              <button className="icon-button refresh-button" title="Refresh work items" aria-label="Refresh work items" onClick={() => void loadItems()}>
                <Activity size={16} />
              </button>
            </div>

            <div className="table-wrap">
              <table className="work-table">
                <thead>
                  <tr>
                    <th>WORK ITEM</th>
                    <th>STATUS</th>
                    <th>PRIORITY</th>
                    <th>ASSIGNEE</th>
                    <th>UPDATED</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="table-message"><LoaderCircle className="spin" size={20} /> Loading work items…</td></tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table-message empty-state">
                        <div className="empty-icon"><Search size={21} /></div>
                        <strong>{error ? 'Work items unavailable' : 'Nothing here just yet'}</strong>
                        <span>{error ? 'Retry the request after checking the backend.' : 'Try another filter or create a new work item.'}</span>
                        {!error && <button className="secondary-button" onClick={() => setShowCreate(true)}><Plus size={15} /> Create work item</button>}
                      </td>
                    </tr>
                  ) : filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="work-title-cell">
                          <span className="work-id">#{String(item.id).padStart(4, '0')}</span>
                          <div className="work-title-copy">
                            <strong>{item.title}</strong>
                            <span>{item.description || 'No description provided'}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className={`status-badge status-${item.status}`}><span className="badge-dot" />{statusLabel[item.status] ?? item.status}</span></td>
                      <td><span className={`priority-badge priority-${item.priority}`}><span className="priority-mark" />{priorityLabel[item.priority] ?? item.priority}</span></td>
                      <td>
                        {item.assignee_id
                          ? <span className="assignee-cell"><span className="assignee-avatar">U{item.assignee_id}</span><span>User {item.assignee_id}</span></span>
                          : <span className="unassigned">Unassigned</span>}
                      </td>
                      <td><span className="updated-cell"><Clock3 size={14} />{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '—'}</span></td>
                      <td><button className="row-action" title={`View ${item.title}`} aria-label={`View work item ${item.id}`} onClick={() => void openItem(item.id)}><ArrowRight size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>Showing <strong>{loading ? 0 : filteredItems.length}</strong> of <strong>{items.length}</strong> work items</span>
              <span className="footer-live"><span className="live-dot" /> Connected to API</span>
            </div>
          </section>
          ) : (
          <section className="overview-analytics" aria-label="Workspace analytics">
            <div className="analytics-grid">
              <section className="workspace-panel chart-panel">
                <div className="section-heading chart-heading">
                  <div>
                    <div className="section-title-row"><h2>Work by status</h2><span className="section-count">{items.length}</span></div>
                    <p className="section-subtitle">Where work currently stands.</p>
                  </div>
                  <span className="chart-period">Live snapshot</span>
                </div>
                {loading ? <div className="panel-empty chart-empty"><LoaderCircle className="spin" size={20} /> Loading status data…</div> : (
                  <div className="status-chart-content">
                    <div className="donut-chart" role="img" aria-label={`Status distribution for ${items.length} work items`} style={{ background: statusGradient }}>
                      <div className="donut-hole"><strong>{items.length}</strong><span>work items</span></div>
                    </div>
                    <div className="chart-legend">
                      {statusBreakdown.map((entry) => (
                        <button className="legend-row" key={entry.status} onClick={() => handleSummaryCardClick(entry.status)}>
                          <span className="legend-label"><span className="legend-dot" style={{ background: entry.color }} />{entry.label}</span>
                          <strong>{entry.value}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="workspace-panel chart-panel">
                <div className="section-heading chart-heading">
                  <div>
                    <div className="section-title-row"><h2>Work by priority</h2></div>
                    <p className="section-subtitle">Spot high-impact work at a glance.</p>
                  </div>
                  <span className="chart-period">All items</span>
                </div>
                {loading ? <div className="panel-empty chart-empty"><LoaderCircle className="spin" size={20} /> Loading priority data…</div> : (
                  <div className="priority-chart">
                    {priorityBreakdown.map((entry) => {
                      const percentage = items.length ? (entry.value / items.length) * 100 : 0
                      return (
                        <button className="priority-chart-row" key={entry.priority} onClick={() => { setActiveNav('Work items'); setPriorityFilter(entry.priority); setStatusFilter('all'); setSearch(''); setMobileNavOpen(false) }}>
                          <span className="priority-chart-label">{entry.label}</span>
                          <span className="priority-track"><span className="priority-fill" style={{ width: `${percentage}%`, background: entry.color }} /></span>
                          <strong>{entry.value}</strong>
                        </button>
                      )
                    })}
                    <div className="priority-chart-note"><ShieldCheck size={15} /><span>Priority counts reflect the current workspace data.</span></div>
                  </div>
                )}
              </section>
            </div>

            <section className="workspace-panel overview-activity">
              <div className="section-heading">
                <div>
                  <div className="section-title-row"><h2>Recent activity</h2><span className="section-count">{activity.length}</span></div>
                  <p className="section-subtitle">The latest changes recorded in your workspace.</p>
                </div>
                <button className="text-button" onClick={() => setActiveNav('Activity')}>View activity <ArrowRight size={15} /></button>
              </div>
              {activityLoading ? <div className="panel-empty recent-empty"><LoaderCircle className="spin" size={18} /> Loading recent activity…</div> : activityError ? <div className="panel-empty recent-empty"><Activity size={20} /><span>Activity is temporarily unavailable.</span><button className="text-button" onClick={() => void loadActivity()}>Try again</button></div> : activity.length === 0 ? <div className="panel-empty recent-empty"><Activity size={20} /><strong>No activity yet</strong><span>Create or update a work item to see its history here.</span></div> : (
                <div className="overview-activity-list">
                  {activity.slice(0, 4).map((event) => (
                    <article className="overview-activity-row" key={event.id}>
                      <span className="activity-node"><Activity size={15} /></span>
                      <div className="overview-activity-copy"><div><strong>{event.actor_name}</strong> <span>{event.action}</span> <button className="inline-link" onClick={() => void openItem(event.work_item_id)}>{event.work_item_title}</button></div><time>{new Date(event.created_at).toLocaleString()}</time></div>
                      <button className="row-action" aria-label={`Open ${event.work_item_title}`} onClick={() => void openItem(event.work_item_id)}><ArrowRight size={15} /></button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
          )}

          <footer className="page-footer">
            <span>OpsFlow <span className="footer-version">v0.1.0</span></span>
            <span>Built for clarity. Designed for momentum.</span>
          </footer>
          </>}
        </div>
      </main>
      
      {(detailLoading || selectedItem || detailError) && (
      <div
        className="modal-backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !detailSaving) {
            setSelectedItem(null)
            setDetailError('')
          }
        }}
      >
        <section
          className="create-modal detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-title"
        >
          <div className="modal-heading">
            <div>
              <span className="eyebrow">WORKSPACE / WORK ITEM</span>
              <h2 id="detail-title">
                {detailLoading
                  ? 'Loading work item…'
                  : selectedItem?.title ?? 'Work item details'}
              </h2>
              <p>
                {selectedItem
                  ? `Item #${String(selectedItem.id).padStart(4, '0')} · Version ${selectedItem.version}`
                  : 'Retrieving the latest item details from the server.'}
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Close details"
              disabled={detailSaving}
              onClick={() => {
                setSelectedItem(null)
                setDetailError('')
              }}
            >
              <X size={19} />
            </button>
          </div>

          {detailLoading && (
            <div className="detail-loading">
              <LoaderCircle className="spin" size={22} />
              Loading current details…
            </div>
          )}

          {selectedItem && !detailLoading && (
            <>
              <div className="detail-badges">
                <span className={`status-badge status-${selectedItem.status}`}>
                  <span className="badge-dot" />
                  {statusLabel[selectedItem.status]}
                </span>
                <span className={`priority-badge priority-${selectedItem.priority}`}>
                  <span className="priority-mark" />
                  {priorityLabel[selectedItem.priority]}
                </span>
              </div>

              <div className="detail-description">
                <span className="detail-label">DESCRIPTION</span>
                <p>
                  {selectedItem.description || 'No description provided.'}
                </p>
              </div>

              <div className="detail-meta-grid">
                <div className="detail-meta">
                  <span className="detail-label">TEAM</span>
                  <strong>Team #{selectedItem.team_id}</strong>
                </div>
                <div className="detail-meta">
                  <span className="detail-label">ASSIGNEE</span>
                  <strong>
                    {selectedItem.assignee_id
                      ? `User #${selectedItem.assignee_id}`
                      : 'Unassigned'}
                  </strong>
                </div>
                <div className="detail-meta">
                  <span className="detail-label">VERSION</span>
                  <strong>{selectedItem.version}</strong>
                </div>
                <div className="detail-meta">
                  <span className="detail-label">LAST UPDATED</span>
                  <strong>
                    {selectedItem.updated_at
                      ? new Date(selectedItem.updated_at).toLocaleString()
                      : 'Not available'}
                  </strong>
                </div>
              </div>

              <div className="detail-update">
                <label className="form-field">
                  <span>Change status</span>
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as Status)}
                    disabled={detailSaving}
                  >
                    <option value={selectedItem.status}>
                      {statusLabel[selectedItem.status]} (current)
                    </option>
                    {allowedTransitions[selectedItem.status].map((status) => (
                      <option key={status} value={status}>
                        {statusLabel[status]}
                      </option>
                    ))}
                  </select>
                </label>

                {allowedTransitions[selectedItem.status].length === 0 && (
                  <p className="detail-hint">
                    This item is closed and has no permitted next status.
                  </p>
                )}
              </div>
            </>
          )}

          {detailError && (
            <div className="form-error" role="alert">
              <AlertCircle size={16} />
              <span>{detailError}</span>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={detailSaving}
              onClick={() => {
                setSelectedItem(null)
                setDetailError('')
              }}
            >
              Close
            </button>

            {selectedItem && (
              <button
                type="button"
                className="secondary-button"
                disabled={detailSaving || detailLoading}
                onClick={() => void openItem(selectedItem.id)}
              >
                Refresh details
              </button>
            )}

            {selectedItem && nextStatus !== selectedItem.status && (
              <button
                type="button"
                className="primary-button"
                disabled={detailSaving}
                onClick={() => void updateItemStatus()}
              >
                {detailSaving ? (
                  <>
                    <LoaderCircle className="spin" size={16} />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Save status
                  </>
                )}
              </button>
            )}
          </div>
        </section>
      </div>
    )}

      {showCreate && (
        <div className="modal-backdrop" onMouseDown={(e) => {
          if (e.target === e.currentTarget && !creating) setShowCreate(false)
        }}>
          <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">WORKSPACE / NEW ITEM</span>
                <h2 id="create-title">Create work item</h2>
                <p>Give the work a clear title and priority.</p>
              </div>
              <button className="icon-button" aria-label="Close dialog" onClick={() => setShowCreate(false)} disabled={creating}><X size={19} /></button>
            </div>
            <form onSubmit={createItem}>
              <label className="form-field">
                <span>Title <span className="required">*</span></span>
                <input autoFocus required maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Investigate delayed payment" />
              </label>
              <label className="form-field">
                <span>Description <span className="optional">(optional)</span></span>
                <textarea rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add context, expected outcome, or next steps…" />
              </label>
              <label className="form-field">
                <span>Priority</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label className="form-field">
                <span>Assignee</span>

                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={membersLoading || !!membersError}
                >
                  <option value="">
                    {membersLoading
                      ? 'Loading team members…'
                      : 'Unassigned'}
                  </option>

                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {member.email}
                    </option>
                  ))}
                </select>

                {membersError && (
                  <span className="detail-hint" role="alert">
                    {membersError}
                  </span>
                )}
              </label>
              <div className="form-note"><ShieldCheck size={15} /> Created in the Operations team.</div>
              {createError && <div className="form-error" role="alert"><AlertCircle size={16} />{createError}</div>}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
                <button type="submit" className="primary-button" disabled={creating || !title.trim()}>
                  {creating ? <><LoaderCircle className="spin" size={16} /> Creating…</> : <><Plus size={16} /> Create item</>}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
