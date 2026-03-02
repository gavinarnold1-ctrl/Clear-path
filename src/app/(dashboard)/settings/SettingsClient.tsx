'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Member {
  id: string
  name: string
  isDefault: boolean
}

interface Property {
  id: string
  name: string
  type: string
  isDefault: boolean
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  taxSchedule?: string | null
  purchasePrice?: string | null
  purchaseDate?: string | null
  buildingValuePct?: string | null
  priorDepreciation?: string | null
}

interface MatchRuleAllocation {
  propertyId: string
  percentage: number
}

interface MatchRule {
  id: string
  name: string
  matchField: string
  matchPattern: string
  allocations: MatchRuleAllocation[]
  isActive: boolean
}

interface SplitRuleItem {
  id: string
  propertyId: string
  allocationPct: number | string
}

interface PropertyGroupData {
  id: string
  name: string
  description: string | null
  properties: Array<{ id: string; name: string; type: string; splitPct: number | string | null }>
  splitRules: SplitRuleItem[]
  matchRules: MatchRule[]
}

interface AccountOption {
  id: string
  name: string
  type: string
}

interface AccountPropertyLinkData {
  id: string
  accountId: string
  propertyId: string
  account: { id: string; name: string }
  property: { id: string; name: string; type: string }
}

interface Props {
  user: { name: string; email: string; createdAt: string }
  initialMembers: Member[]
  initialProperties: Property[]
  initialAccounts?: AccountOption[]
}

export default function SettingsClient({ user, initialMembers, initialProperties, initialAccounts = [] }: Props) {
  const router = useRouter()

  // Profile state
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Household members state
  const [members, setMembers] = useState(initialMembers)
  const [newMemberName, setNewMemberName] = useState('')
  const [memberSaving, setMemberSaving] = useState(false)
  const [memberMsg, setMemberMsg] = useState<string | null>(null)

  // Properties state
  const [properties, setProperties] = useState(initialProperties)
  const [newPropName, setNewPropName] = useState('')
  const [newPropType, setNewPropType] = useState<'PERSONAL' | 'RENTAL' | 'BUSINESS'>('PERSONAL')
  const [newPropAddress, setNewPropAddress] = useState('')
  const [newPropCity, setNewPropCity] = useState('')
  const [newPropState, setNewPropState] = useState('')
  const [newPropZip, setNewPropZip] = useState('')
  const [newPropPurchasePrice, setNewPropPurchasePrice] = useState('')
  const [newPropPurchaseDate, setNewPropPurchaseDate] = useState('')
  const [newPropBuildingPct, setNewPropBuildingPct] = useState('')
  const [newPropPriorDepr, setNewPropPriorDepr] = useState('')
  const [showPropDetails, setShowPropDetails] = useState(false)
  const [propSaving, setPropSaving] = useState(false)
  const [propMsg, setPropMsg] = useState<string | null>(null)

  // Property Groups state
  const [groups, setGroups] = useState<PropertyGroupData[]>([])
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [groupSaving, setGroupSaving] = useState(false)
  const [groupMsg, setGroupMsg] = useState<string | null>(null)
  // Expanded group for editing
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  // Add property to group
  const [addPropGroupId, setAddPropGroupId] = useState<string | null>(null)
  const [addPropToGroupId, setAddPropToGroupId] = useState('')
  // Match rule form
  const [showMatchRuleForm, setShowMatchRuleForm] = useState<string | null>(null) // groupId
  const [mrName, setMrName] = useState('')
  const [mrMatchField, setMrMatchField] = useState<'merchant' | 'category' | 'description'>('merchant')
  const [mrMatchPattern, setMrMatchPattern] = useState('')
  const [mrAllocations, setMrAllocations] = useState<MatchRuleAllocation[]>([])
  const [mrSaving, setMrSaving] = useState(false)
  // Backfill
  const [backfillGroupId, setBackfillGroupId] = useState<string | null>(null)
  const [backfillMsg, setBackfillMsg] = useState<{ groupId: string; type: 'success' | 'error'; text: string } | null>(null)

  // Account-Property Links state
  const [acctPropLinks, setAcctPropLinks] = useState<AccountPropertyLinkData[]>([])
  const [acctPropLinksLoaded, setAcctPropLinksLoaded] = useState(false)
  const [acctPropLinksLoading, setAcctPropLinksLoading] = useState(false)
  const [newLinkAccountId, setNewLinkAccountId] = useState('')
  const [newLinkPropertyId, setNewLinkPropertyId] = useState('')
  const [linkSaving, setLinkSaving] = useState(false)
  const [linkMsg, setLinkMsg] = useState<string | null>(null)

  // Learned categories state
  interface CategoryMapping {
    id: string
    merchantName: string
    confidence: number
    timesApplied: number
    direction: string | null
    amountMin: number | null
    amountMax: number | null
    category: { id: string; name: string; type: string; group: string }
  }
  const [mappings, setMappings] = useState<CategoryMapping[]>([])
  const [mappingsLoaded, setMappingsLoaded] = useState(false)
  const [mappingsLoading, setMappingsLoading] = useState(false)

  // Data tools state
  const [fixingClassification, setFixingClassification] = useState(false)
  const [fixMsg, setFixMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)

  // ─── Profile ─────────────────────────────────────────────────────────────
  async function saveProfile() {
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || null, email }),
      })
      if (!res.ok) {
        const data = await res.json()
        setProfileMsg({ type: 'error', text: data.error ?? 'Failed to update profile.' })
        return
      }
      setProfileMsg({ type: 'success', text: 'Profile updated.' })
      router.refresh()
    } catch {
      setProfileMsg({ type: 'error', text: 'Network error.' })
    } finally {
      setProfileSaving(false)
    }
  }

  async function changePassword() {
    setPasswordSaving(true)
    setPasswordMsg(null)
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        setPasswordMsg({ type: 'error', text: data.error ?? 'Failed to change password.' })
        return
      }
      setPasswordMsg({ type: 'success', text: 'Password changed.' })
      setCurrentPassword('')
      setNewPassword('')
    } catch {
      setPasswordMsg({ type: 'error', text: 'Network error.' })
    } finally {
      setPasswordSaving(false)
    }
  }

  // ─── Household Members ───────────────────────────────────────────────────
  async function addMember() {
    const trimmed = newMemberName.trim()
    if (!trimmed || memberSaving) return
    setMemberSaving(true)
    setMemberMsg(null)
    try {
      const res = await fetch('/api/household-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json()
        setMemberMsg(data.error ?? 'Failed to add member.')
        return
      }
      const member = await res.json()
      setMembers((prev) => [...prev, member])
      setNewMemberName('')
      router.refresh()
    } catch {
      setMemberMsg('Network error.')
    } finally {
      setMemberSaving(false)
    }
  }

  async function deleteMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
    try {
      const res = await fetch(`/api/household-members/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setMembers(initialMembers)
        setMemberMsg('Failed to delete member.')
      }
      router.refresh()
    } catch {
      setMembers(initialMembers)
      setMemberMsg('Network error.')
    }
  }

  async function setDefaultMember(id: string) {
    try {
      const res = await fetch(`/api/household-members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      if (res.ok) {
        setMembers((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })))
        router.refresh()
      }
    } catch {
      setMemberMsg('Network error.')
    }
  }

  // ─── Properties ──────────────────────────────────────────────────────────
  function resetPropForm() {
    setNewPropName('')
    setNewPropAddress('')
    setNewPropCity('')
    setNewPropState('')
    setNewPropZip('')
    setNewPropPurchasePrice('')
    setNewPropPurchaseDate('')
    setNewPropBuildingPct('')
    setNewPropPriorDepr('')
    setShowPropDetails(false)
  }

  async function addProperty() {
    const trimmed = newPropName.trim()
    if (!trimmed || propSaving) return
    setPropSaving(true)
    setPropMsg(null)
    try {
      const payload: Record<string, unknown> = { name: trimmed, type: newPropType }
      if (newPropAddress.trim()) payload.address = newPropAddress.trim()
      if (newPropCity.trim()) payload.city = newPropCity.trim()
      if (newPropState.trim()) payload.state = newPropState.trim()
      if (newPropZip.trim()) payload.zipCode = newPropZip.trim()
      if (newPropPurchasePrice) payload.purchasePrice = parseFloat(newPropPurchasePrice)
      if (newPropPurchaseDate) payload.purchaseDate = newPropPurchaseDate
      if (newPropBuildingPct) payload.buildingValuePct = parseFloat(newPropBuildingPct)
      if (newPropPriorDepr) payload.priorDepreciation = parseFloat(newPropPriorDepr)

      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        setPropMsg(data.error ?? 'Failed to add property.')
        return
      }
      const prop = await res.json()
      setProperties((prev) => [...prev, prop])
      resetPropForm()
      router.refresh()
    } catch {
      setPropMsg('Network error.')
    } finally {
      setPropSaving(false)
    }
  }

  async function deleteProperty(id: string) {
    setProperties((prev) => prev.filter((p) => p.id !== id))
    try {
      const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setProperties(initialProperties)
        setPropMsg('Failed to delete property.')
      }
      router.refresh()
    } catch {
      setProperties(initialProperties)
      setPropMsg('Network error.')
    }
  }

  async function setDefaultProperty(id: string) {
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      if (res.ok) {
        setProperties((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })))
        router.refresh()
      }
    } catch {
      setPropMsg('Network error.')
    }
  }

  // ─── Property Groups ────────────────────────────────────────────────────
  async function loadGroups() {
    if (groupsLoading) return
    setGroupsLoading(true)
    try {
      const res = await fetch('/api/property-groups')
      if (res.ok) {
        const data = await res.json()
        setGroups(data)
        setGroupsLoaded(true)
      }
    } catch {
      // ignore
    } finally {
      setGroupsLoading(false)
    }
  }

  async function createGroup() {
    const trimmed = newGroupName.trim()
    if (!trimmed || groupSaving) return
    setGroupSaving(true)
    setGroupMsg(null)
    try {
      const res = await fetch('/api/property-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, description: newGroupDesc.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        setGroupMsg(data.error ?? 'Failed to create group.')
        return
      }
      const group = await res.json()
      setGroups((prev) => [...prev, group])
      setNewGroupName('')
      setNewGroupDesc('')
    } catch {
      setGroupMsg('Network error.')
    } finally {
      setGroupSaving(false)
    }
  }

  async function deleteGroup(id: string) {
    if (!confirm('Delete this property group? Split rules will be removed and properties unlinked.')) return
    setGroups((prev) => prev.filter((g) => g.id !== id))
    try {
      const res = await fetch(`/api/property-groups/${id}`, { method: 'DELETE' })
      if (!res.ok) loadGroups()
    } catch {
      loadGroups()
    }
  }

  async function addPropertyToGroup(groupId: string, propertyId: string) {
    if (!propertyId) return
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      })
      if (res.ok) {
        await loadGroups()
        setAddPropGroupId(null)
        setAddPropToGroupId('')
      }
    } catch {
      setGroupMsg('Network error.')
    }
  }

  async function removePropertyFromGroup(propertyId: string) {
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: null, splitPct: null }),
      })
      if (res.ok) loadGroups()
    } catch {
      setGroupMsg('Network error.')
    }
  }

  async function saveSplitAllocations(groupId: string) {
    const group = groups.find((g) => g.id === groupId)
    if (!group || group.properties.length === 0) return
    setGroupMsg(null)
    try {
      const allocations = group.properties.map((p) => ({
        propertyId: p.id,
        allocationPct: typeof p.splitPct === 'string' ? parseFloat(p.splitPct) : (p.splitPct ?? 0),
      }))
      const res = await fetch('/api/split-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, allocations }),
      })
      if (!res.ok) {
        const data = await res.json()
        setGroupMsg(data.error ?? 'Failed to save allocations.')
        return
      }
      setGroupMsg(null)
      loadGroups()
    } catch {
      setGroupMsg('Network error.')
    }
  }

  function updatePropertySplitPct(groupId: string, propertyId: string, pct: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, properties: g.properties.map((p) => (p.id === propertyId ? { ...p, splitPct: pct } : p)) }
          : g
      )
    )
  }

  function getGroupTotalPct(group: PropertyGroupData): number {
    return group.properties.reduce((sum, p) => {
      const val = typeof p.splitPct === 'string' ? parseFloat(p.splitPct) : (Number(p.splitPct) || 0)
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
  }

  function initMatchRuleForm(groupId: string) {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    setShowMatchRuleForm(groupId)
    setMrName('')
    setMrMatchField('merchant')
    setMrMatchPattern('')
    // Pre-populate allocations from group default split %
    setMrAllocations(
      group.properties.map((p) => ({
        propertyId: p.id,
        percentage: typeof p.splitPct === 'string' ? parseFloat(p.splitPct) || 0 : (Number(p.splitPct) || 0),
      }))
    )
  }

  async function createMatchRule(groupId: string) {
    if (!mrName.trim() || !mrMatchPattern.trim() || mrSaving) return
    setMrSaving(true)
    setGroupMsg(null)
    try {
      const res = await fetch('/api/split-match-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          name: mrName.trim(),
          matchField: mrMatchField,
          matchPattern: mrMatchPattern.trim(),
          allocations: mrAllocations,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setGroupMsg(data.error ?? 'Failed to create rule.')
        return
      }
      setShowMatchRuleForm(null)
      loadGroups()
    } catch {
      setGroupMsg('Network error.')
    } finally {
      setMrSaving(false)
    }
  }

  async function toggleMatchRule(id: string, isActive: boolean) {
    try {
      await fetch(`/api/split-match-rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      loadGroups()
    } catch {
      // ignore
    }
  }

  async function deleteMatchRule(id: string) {
    try {
      await fetch(`/api/split-match-rules/${id}`, { method: 'DELETE' })
      loadGroups()
    } catch {
      // ignore
    }
  }

  async function runBackfill(groupId: string) {
    setBackfillGroupId(groupId)
    setBackfillMsg(null)
    try {
      const res = await fetch(`/api/property-groups/${groupId}/backfill`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setBackfillMsg({ groupId, type: 'error', text: data.error ?? 'Backfill failed.' })
        return
      }
      setBackfillMsg({
        groupId,
        type: 'success',
        text: `Matched ${data.matched} of ${data.total} transactions, created ${data.splits} split records.`,
      })
    } catch {
      setBackfillMsg({ groupId, type: 'error', text: 'Network error.' })
    } finally {
      setBackfillGroupId(null)
    }
  }

  // ─── Account-Property Links ───────────────────────────────────────────
  async function loadAcctPropLinks() {
    if (acctPropLinksLoading) return
    setAcctPropLinksLoading(true)
    try {
      const res = await fetch('/api/account-property-links')
      if (res.ok) {
        const data = await res.json()
        setAcctPropLinks(data)
        setAcctPropLinksLoaded(true)
      }
    } catch {
      // ignore
    } finally {
      setAcctPropLinksLoading(false)
    }
  }

  async function createAcctPropLink() {
    if (!newLinkAccountId || !newLinkPropertyId || linkSaving) return
    setLinkSaving(true)
    setLinkMsg(null)
    try {
      const res = await fetch('/api/account-property-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: newLinkAccountId, propertyId: newLinkPropertyId }),
      })
      if (res.ok) {
        const link = await res.json()
        setAcctPropLinks(prev => [...prev, link])
        setNewLinkAccountId('')
        setNewLinkPropertyId('')
      } else {
        const data = await res.json()
        setLinkMsg(data.error || 'Failed to create link')
      }
    } catch {
      setLinkMsg('Failed to create link')
    } finally {
      setLinkSaving(false)
    }
  }

  async function deleteAcctPropLink(linkId: string) {
    try {
      const res = await fetch(`/api/account-property-links?id=${linkId}`, { method: 'DELETE' })
      if (res.ok) {
        setAcctPropLinks(prev => prev.filter(l => l.id !== linkId))
      }
    } catch {
      // ignore
    }
  }

  // ─── Learned Categories ─────────────────────────────────────────────────
  async function loadMappings() {
    if (mappingsLoading) return
    setMappingsLoading(true)
    try {
      const res = await fetch('/api/category-mappings')
      if (res.ok) {
        const data = await res.json()
        setMappings(data)
        setMappingsLoaded(true)
      }
    } catch {
      // ignore
    } finally {
      setMappingsLoading(false)
    }
  }

  async function deleteMapping(id: string) {
    setMappings(prev => prev.filter(m => m.id !== id))
    try {
      const res = await fetch(`/api/category-mappings/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        loadMappings() // revert on failure
      }
    } catch {
      loadMappings()
    }
  }

  // ─── Data Tools ─────────────────────────────────────────────────────────
  async function fixClassifications() {
    if (fixingClassification) return
    setFixingClassification(true)
    setFixMsg(null)
    try {
      const res = await fetch('/api/transactions/fix-classification', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setFixMsg({ type: 'error', text: data.error ?? 'Failed to fix classifications.' })
        return
      }
      setFixMsg({ type: 'success', text: data.message })
      router.refresh()
    } catch {
      setFixMsg({ type: 'error', text: 'Network error.' })
    } finally {
      setFixingClassification(false)
    }
  }

  async function resetAllData() {
    if (resetting) return
    setResetting(true)
    setResetMsg(null)
    try {
      const res = await fetch('/api/profile/reset', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setResetMsg({ type: 'error', text: data.error ?? 'Failed to reset data.' })
        return
      }
      setResetMsg({ type: 'success', text: data.message })
      setShowResetConfirm(false)
      setMembers([])
      setProperties([])
      router.refresh()
    } catch {
      setResetMsg({ type: 'error', text: 'Network error.' })
    } finally {
      setResetting(false)
    }
  }

  // ─── Delete Account ──────────────────────────────────────────────────────
  async function handleDeleteAccount() {
    if (!deletePassword || deleting) return
    setDeleting(true)
    setDeleteMsg(null)
    try {
      const res = await fetch('/api/profile/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        setDeleteMsg(data.error ?? 'Failed to delete account.')
        return
      }
      // Redirect to login after deletion
      window.location.href = '/login'
    } catch {
      setDeleteMsg('Network error.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* R10.1: Profile Management */}
      <section className="card">
        <h2 className="mb-4 text-base font-semibold text-fjord">Profile</h2>
        <div className="space-y-3">
          <div>
            <label htmlFor="settings-name" className="mb-1 block text-sm font-medium text-fjord">Name</label>
            <input
              id="settings-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input max-w-sm text-sm"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="settings-email" className="mb-1 block text-sm font-medium text-fjord">Email</label>
            <input
              id="settings-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input max-w-sm text-sm"
            />
          </div>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.type === 'success' ? 'text-income' : 'text-expense'}`}>
              {profileMsg.text}
            </p>
          )}
          <button onClick={saveProfile} disabled={profileSaving} className="btn-primary text-sm">
            {profileSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        <hr className="my-5 border-mist" />

        <h3 className="mb-3 text-sm font-semibold text-fjord">Change Password</h3>
        <div className="space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input max-w-sm text-sm"
            placeholder="Current password"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input max-w-sm text-sm"
            placeholder="New password (min 8 characters)"
          />
          {passwordMsg && (
            <p className={`text-sm ${passwordMsg.type === 'success' ? 'text-income' : 'text-expense'}`}>
              {passwordMsg.text}
            </p>
          )}
          <button
            onClick={changePassword}
            disabled={passwordSaving || !currentPassword || newPassword.length < 8}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {passwordSaving ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </section>

      {/* R10.2: Household Members */}
      <section className="card">
        <h2 className="mb-4 text-base font-semibold text-fjord">Household Members</h2>
        {members.length === 0 ? (
          <p className="mb-3 text-sm text-stone">No household members yet.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-lg border border-mist bg-snow px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fjord">{m.name}</span>
                  {m.isDefault && (
                    <span className="rounded-badge bg-pine/10 px-1.5 py-0.5 text-[10px] font-medium text-pine">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!m.isDefault && (
                    <button
                      onClick={() => setDefaultMember(m.id)}
                      className="text-xs text-stone hover:text-fjord"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    onClick={() => deleteMember(m.id)}
                    className="text-xs text-stone hover:text-ember"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {memberMsg && <p className="mb-2 text-sm text-expense">{memberMsg}</p>}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            className="input flex-1 text-sm"
            placeholder="Member name"
            onKeyDown={(e) => e.key === 'Enter' && addMember()}
          />
          <button onClick={addMember} disabled={memberSaving || !newMemberName.trim()} className="btn-primary text-sm">
            {memberSaving ? 'Adding...' : 'Add'}
          </button>
        </div>
      </section>

      {/* R10.3: Properties & Entities */}
      <section className="card">
        <h2 className="mb-4 text-base font-semibold text-fjord">Properties &amp; Entities</h2>
        {properties.length === 0 ? (
          <p className="mb-3 text-sm text-stone">No properties yet.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {properties.map((p) => {
              const typeLabel = p.type === 'RENTAL' ? 'Rental' : p.type === 'BUSINESS' ? 'Business' : 'Personal'
              const scheduleLabel = p.taxSchedule === 'SCHEDULE_E' ? 'Sch E' : p.taxSchedule === 'SCHEDULE_C' ? 'Sch C' : p.taxSchedule === 'SCHEDULE_A' ? 'Sch A' : null
              return (
                <li key={p.id} className="rounded-lg border border-mist bg-snow px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-fjord">{p.name}</span>
                      <span className="rounded-badge bg-frost px-1.5 py-0.5 text-[10px] font-medium text-stone">
                        {typeLabel}
                      </span>
                      {scheduleLabel && (
                        <span className="rounded-badge bg-birch/20 px-1.5 py-0.5 text-[10px] font-medium text-stone">
                          {scheduleLabel}
                        </span>
                      )}
                      {p.isDefault && (
                        <span className="rounded-badge bg-pine/10 px-1.5 py-0.5 text-[10px] font-medium text-pine">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!p.isDefault && (
                        <button
                          onClick={() => setDefaultProperty(p.id)}
                          className="text-xs text-stone hover:text-fjord"
                        >
                          Set default
                        </button>
                      )}
                      <button
                        onClick={() => deleteProperty(p.id)}
                        className="text-xs text-stone hover:text-ember"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {(p.address || p.city) && (
                    <p className="mt-1 text-xs text-stone">
                      {[p.address, p.city, p.state, p.zipCode].filter(Boolean).join(', ')}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {propMsg && <p className="mb-2 text-sm text-expense">{propMsg}</p>}

        {/* Add property form */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newPropName}
              onChange={(e) => setNewPropName(e.target.value)}
              className="input flex-1 text-sm"
              placeholder="Property / entity name"
              onKeyDown={(e) => e.key === 'Enter' && !showPropDetails && addProperty()}
            />
            <select
              value={newPropType}
              onChange={(e) => setNewPropType(e.target.value as 'PERSONAL' | 'RENTAL' | 'BUSINESS')}
              className="input w-32 text-sm"
            >
              <option value="PERSONAL">Personal</option>
              <option value="RENTAL">Rental</option>
              <option value="BUSINESS">Business</option>
            </select>
            <button
              type="button"
              onClick={() => setShowPropDetails(!showPropDetails)}
              className="text-xs text-stone hover:text-fjord"
              title={showPropDetails ? 'Hide details' : 'Show details'}
            >
              {showPropDetails ? 'Less' : 'More'}
            </button>
            <button onClick={addProperty} disabled={propSaving || !newPropName.trim()} className="btn-primary text-sm">
              {propSaving ? 'Adding...' : 'Add'}
            </button>
          </div>

          {showPropDetails && (
            <div className="rounded-lg border border-mist bg-frost/30 p-3 space-y-3">
              {/* Address fields */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-fjord">Address</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={newPropAddress}
                    onChange={(e) => setNewPropAddress(e.target.value)}
                    className="input text-sm"
                    placeholder="Street address"
                  />
                  <input
                    type="text"
                    value={newPropCity}
                    onChange={(e) => setNewPropCity(e.target.value)}
                    className="input text-sm"
                    placeholder="City"
                  />
                  <input
                    type="text"
                    value={newPropState}
                    onChange={(e) => setNewPropState(e.target.value)}
                    className="input text-sm"
                    placeholder="State"
                  />
                  <input
                    type="text"
                    value={newPropZip}
                    onChange={(e) => setNewPropZip(e.target.value)}
                    className="input text-sm"
                    placeholder="ZIP code"
                  />
                </div>
              </div>

              {/* Tax schedule auto-display */}
              <div>
                <p className="text-xs text-stone">
                  Tax schedule:{' '}
                  <span className="font-medium text-fjord">
                    {newPropType === 'PERSONAL' ? 'Schedule A' : newPropType === 'RENTAL' ? 'Schedule E' : 'Schedule C'}
                  </span>
                  <span className="ml-1 text-[10px] text-stone">(auto-set from type)</span>
                </p>
              </div>

              {/* Depreciation fields — shown for RENTAL */}
              {newPropType === 'RENTAL' && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-fjord">Depreciation</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="number"
                      value={newPropPurchasePrice}
                      onChange={(e) => setNewPropPurchasePrice(e.target.value)}
                      className="input text-sm"
                      placeholder="Purchase price"
                      min="0"
                      step="0.01"
                    />
                    <input
                      type="date"
                      value={newPropPurchaseDate}
                      onChange={(e) => setNewPropPurchaseDate(e.target.value)}
                      className="input text-sm"
                    />
                    <input
                      type="number"
                      value={newPropBuildingPct}
                      onChange={(e) => setNewPropBuildingPct(e.target.value)}
                      className="input text-sm"
                      placeholder="Building value % (e.g. 80)"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                    <input
                      type="number"
                      value={newPropPriorDepr}
                      onChange={(e) => setNewPropPriorDepr(e.target.value)}
                      className="input text-sm"
                      placeholder="Prior depreciation"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Property Groups */}
      <section className="card">
        <h2 className="mb-4 text-base font-semibold text-fjord">Property Groups</h2>
        <p className="mb-3 text-sm text-stone">
          Group properties together and define split rules for shared expenses.
        </p>

        {!groupsLoaded ? (
          <button onClick={loadGroups} disabled={groupsLoading} className="btn-secondary text-sm mb-4">
            {groupsLoading ? 'Loading...' : 'Load Property Groups'}
          </button>
        ) : (
          <>
            {groups.length === 0 ? (
              <p className="mb-3 text-sm text-stone">No property groups yet.</p>
            ) : (
              <div className="mb-4 space-y-3">
                {groups.map((group) => {
                  const isExpanded = expandedGroupId === group.id
                  const totalPct = getGroupTotalPct(group)
                  const pctValid = Math.abs(totalPct - 100) < 0.01
                  const activeRules = group.matchRules.filter((r) => r.isActive).length
                  const ungroupedProps = properties.filter(
                    (p) => !groups.some((g) => g.properties.some((gp) => gp.id === p.id))
                  )

                  return (
                    <div key={group.id} className="rounded-lg border border-mist bg-snow">
                      {/* Group header */}
                      <div
                        className="flex cursor-pointer items-center justify-between px-3 py-2"
                        onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-fjord">{group.name}</span>
                          <span className="rounded-badge bg-frost px-1.5 py-0.5 text-[10px] font-medium text-stone">
                            {group.properties.length} properties
                          </span>
                          {activeRules > 0 && (
                            <span className="rounded-badge bg-pine/10 px-1.5 py-0.5 text-[10px] font-medium text-pine">
                              {activeRules} rule{activeRules !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteGroup(group.id) }}
                            className="text-xs text-stone hover:text-ember"
                          >
                            Delete
                          </button>
                          <span className="text-xs text-stone">{isExpanded ? '\u25B2' : '\u25BC'}</span>
                        </div>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="border-t border-mist px-3 py-3 space-y-4">
                          {group.description && (
                            <p className="text-xs text-stone">{group.description}</p>
                          )}

                          {/* Member properties with split % */}
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-fjord">Members &amp; Allocation</p>
                            {group.properties.length === 0 ? (
                              <p className="text-xs text-stone">No properties in this group yet.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {group.properties.map((p) => (
                                  <div key={p.id} className="flex items-center gap-2">
                                    <span className="text-sm text-fjord flex-1">{p.name}</span>
                                    <input
                                      type="number"
                                      value={p.splitPct ?? ''}
                                      onChange={(e) => updatePropertySplitPct(group.id, p.id, e.target.value)}
                                      className="input w-20 text-sm text-right"
                                      placeholder="%"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                    />
                                    <span className="text-xs text-stone">%</span>
                                    <button
                                      onClick={() => removePropertyFromGroup(p.id)}
                                      className="text-xs text-stone hover:text-ember"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                                {/* Total indicator */}
                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <span className={`text-xs font-medium ${pctValid ? 'text-pine' : 'text-ember'}`}>
                                    Total: {totalPct.toFixed(2)}%
                                  </span>
                                  {group.properties.length > 0 && (
                                    <button
                                      onClick={() => saveSplitAllocations(group.id)}
                                      disabled={!pctValid}
                                      className="btn-primary text-xs disabled:opacity-50"
                                    >
                                      Save Allocations
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Add property to group */}
                            {ungroupedProps.length > 0 && (
                              addPropGroupId === group.id ? (
                                <div className="mt-2 flex items-center gap-2">
                                  <select
                                    value={addPropToGroupId}
                                    onChange={(e) => setAddPropToGroupId(e.target.value)}
                                    className="input flex-1 text-sm"
                                  >
                                    <option value="">Select property...</option>
                                    {ungroupedProps.map((p) => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => addPropertyToGroup(group.id, addPropToGroupId)}
                                    disabled={!addPropToGroupId}
                                    className="btn-primary text-xs disabled:opacity-50"
                                  >
                                    Add
                                  </button>
                                  <button
                                    onClick={() => { setAddPropGroupId(null); setAddPropToGroupId('') }}
                                    className="text-xs text-stone hover:text-fjord"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setAddPropGroupId(group.id)}
                                  className="mt-2 text-xs text-fjord hover:text-midnight"
                                >
                                  + Add Property to Group
                                </button>
                              )
                            )}
                          </div>

                          {/* Split Match Rules */}
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-fjord">Split Rules</p>
                            {group.matchRules.length === 0 ? (
                              <p className="text-xs text-stone">No split rules yet.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {group.matchRules.map((rule) => {
                                  const allocSummary = (rule.allocations as MatchRuleAllocation[])
                                    .map((a) => {
                                      const propName = group.properties.find((p) => p.id === a.propertyId)?.name ?? '?'
                                      return `${propName} ${a.percentage}%`
                                    })
                                    .join(', ')
                                  return (
                                    <div
                                      key={rule.id}
                                      className={`flex items-center justify-between rounded-lg border px-3 py-2 ${rule.isActive ? 'border-mist bg-snow' : 'border-mist/50 bg-frost/30 opacity-60'}`}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-fjord">{rule.name}</span>
                                          <span className="rounded-badge bg-frost px-1.5 py-0.5 text-[10px] text-stone">
                                            {rule.matchField}: &ldquo;{rule.matchPattern}&rdquo;
                                          </span>
                                        </div>
                                        <p className="mt-0.5 text-[10px] text-stone">{allocSummary}</p>
                                      </div>
                                      <div className="flex items-center gap-2 ml-2">
                                        <button
                                          onClick={() => toggleMatchRule(rule.id, !rule.isActive)}
                                          className="text-xs text-stone hover:text-fjord"
                                        >
                                          {rule.isActive ? 'Disable' : 'Enable'}
                                        </button>
                                        <button
                                          onClick={() => deleteMatchRule(rule.id)}
                                          className="text-xs text-stone hover:text-ember"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* Add Match Rule form */}
                            {showMatchRuleForm === group.id ? (
                              <div className="mt-2 rounded-lg border border-mist bg-frost/30 p-3 space-y-2">
                                <input
                                  type="text"
                                  value={mrName}
                                  onChange={(e) => setMrName(e.target.value)}
                                  className="input text-sm w-full"
                                  placeholder="Rule name (e.g. Mortgage Split)"
                                />
                                <div className="flex items-center gap-2">
                                  <select
                                    value={mrMatchField}
                                    onChange={(e) => setMrMatchField(e.target.value as 'merchant' | 'category' | 'description')}
                                    className="input w-36 text-sm"
                                  >
                                    <option value="merchant">Merchant</option>
                                    <option value="category">Category</option>
                                    <option value="description">Description</option>
                                  </select>
                                  <input
                                    type="text"
                                    value={mrMatchPattern}
                                    onChange={(e) => setMrMatchPattern(e.target.value)}
                                    className="input flex-1 text-sm"
                                    placeholder="Match pattern (e.g. Wells Fargo)"
                                  />
                                </div>
                                {/* Allocation per property */}
                                <div className="space-y-1">
                                  <p className="text-[10px] font-medium text-stone">Allocation per property:</p>
                                  {mrAllocations.map((alloc, i) => {
                                    const propName = group.properties.find((p) => p.id === alloc.propertyId)?.name ?? '?'
                                    return (
                                      <div key={alloc.propertyId} className="flex items-center gap-2">
                                        <span className="text-xs text-fjord flex-1">{propName}</span>
                                        <input
                                          type="number"
                                          value={alloc.percentage}
                                          onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0
                                            setMrAllocations((prev) =>
                                              prev.map((a, idx) => idx === i ? { ...a, percentage: val } : a)
                                            )
                                          }}
                                          className="input w-20 text-sm text-right"
                                          min="0"
                                          max="100"
                                          step="0.01"
                                        />
                                        <span className="text-xs text-stone">%</span>
                                      </div>
                                    )
                                  })}
                                  {mrAllocations.length > 0 && (
                                    <p className={`text-right text-xs font-medium ${Math.abs(mrAllocations.reduce((s, a) => s + a.percentage, 0) - 100) < 0.01 ? 'text-pine' : 'text-ember'}`}>
                                      Total: {mrAllocations.reduce((s, a) => s + a.percentage, 0).toFixed(2)}%
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    onClick={() => createMatchRule(group.id)}
                                    disabled={mrSaving || !mrName.trim() || !mrMatchPattern.trim() || Math.abs(mrAllocations.reduce((s, a) => s + a.percentage, 0) - 100) >= 0.01}
                                    className="btn-primary text-xs disabled:opacity-50"
                                  >
                                    {mrSaving ? 'Creating...' : 'Create Rule'}
                                  </button>
                                  <button
                                    onClick={() => setShowMatchRuleForm(null)}
                                    className="text-xs text-stone hover:text-fjord"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              group.properties.length > 0 && (
                                <button
                                  onClick={() => initMatchRuleForm(group.id)}
                                  className="mt-2 text-xs text-fjord hover:text-midnight"
                                >
                                  + Add Split Rule
                                </button>
                              )
                            )}
                          </div>

                          {/* Backfill */}
                          {group.matchRules.some((r) => r.isActive) && (
                            <div>
                              <button
                                onClick={() => runBackfill(group.id)}
                                disabled={backfillGroupId === group.id}
                                className="btn-secondary text-xs disabled:opacity-50"
                              >
                                {backfillGroupId === group.id ? 'Running...' : 'Backfill Historical Transactions'}
                              </button>
                              {backfillMsg && backfillMsg.groupId === group.id && (
                                <p className={`mt-1 text-xs ${backfillMsg.type === 'success' ? 'text-income' : 'text-expense'}`}>
                                  {backfillMsg.text}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Create group form */}
            {groupMsg && <p className="mb-2 text-sm text-expense">{groupMsg}</p>}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="input flex-1 text-sm"
                  placeholder="Group name"
                  onKeyDown={(e) => e.key === 'Enter' && createGroup()}
                />
                <button onClick={createGroup} disabled={groupSaving || !newGroupName.trim()} className="btn-primary text-sm">
                  {groupSaving ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* R10.4: Connected Accounts (placeholder) */}
      <section className="card">
        <h2 className="mb-4 text-base font-semibold text-fjord">Connected Accounts</h2>
        <p className="text-sm text-stone">
          Bank connections via Plaid will be available in a future update. For now, use{' '}
          <a href="/accounts" className="font-medium text-fjord hover:underline">manual accounts</a>{' '}
          and{' '}
          <a href="/transactions/import" className="font-medium text-fjord hover:underline">CSV import</a>.
        </p>
      </section>

      {/* R10.5: Data Export */}
      <section className="card">
        <h2 className="mb-4 text-base font-semibold text-fjord">Export Data</h2>
        <p className="mb-3 text-sm text-stone">
          Download all your transactions as a CSV file.
        </p>
        <a href="/api/transactions/export" download className="btn-secondary inline-block text-sm">
          Download Transactions CSV
        </a>
      </section>

      {/* Smart Category Learning */}
      <section className="card">
        <h2 className="mb-2 text-base font-semibold text-fjord">Learned Categories</h2>
        <p className="mb-3 text-sm text-stone">
          When you reclassify a transaction, the app learns and auto-categorizes future transactions
          from the same merchant. Mappings shown below.
        </p>
        {!mappingsLoaded ? (
          <button
            onClick={loadMappings}
            disabled={mappingsLoading}
            className="btn-secondary text-sm"
          >
            {mappingsLoading ? 'Loading...' : 'Show Learned Mappings'}
          </button>
        ) : mappings.length === 0 ? (
          <p className="text-sm text-stone">No learned mappings yet. Reclassify a transaction to start learning.</p>
        ) : (
          <div className="space-y-1.5">
            {mappings.map(m => {
              const context: string[] = []
              if (m.direction) context.push(m.direction)
              if (m.amountMin != null && m.amountMax != null) {
                context.push(`$${m.amountMin.toFixed(0)}-$${m.amountMax.toFixed(0)}`)
              }
              return (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-mist bg-snow px-3 py-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-fjord">{m.merchantName}</span>
                    {context.length > 0 && (
                      <span className="ml-1 text-[10px] text-stone">({context.join(', ')})</span>
                    )}
                    <span className="mx-2 text-xs text-stone">&rarr;</span>
                    <span className="text-sm text-fjord">{m.category.name}</span>
                    {m.timesApplied > 0 && (
                      <span className="ml-2 text-[10px] text-stone">
                        applied {m.timesApplied} time{m.timesApplied !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMapping(m.id)}
                    className="ml-2 shrink-0 text-xs text-stone hover:text-ember"
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Account-Property Links */}
      {initialAccounts.length > 0 && properties.length > 0 && (
        <section className="card">
          <h2 className="mb-4 text-base font-semibold text-fjord">Account-Property Links</h2>
          <p className="mb-4 text-sm text-stone">
            Link accounts to properties so transactions from that account are automatically attributed to the linked property.
          </p>

          {!acctPropLinksLoaded ? (
            <button
              onClick={loadAcctPropLinks}
              disabled={acctPropLinksLoading}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {acctPropLinksLoading ? 'Loading...' : 'Load Account-Property Links'}
            </button>
          ) : (
            <>
              {/* Existing links */}
              {acctPropLinks.length > 0 && (
                <div className="mb-4 space-y-2">
                  {acctPropLinks.map(link => (
                    <div key={link.id} className="flex items-center justify-between rounded-lg border border-mist bg-snow px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-fjord">{link.account.name}</span>
                        <span className="mx-2 text-xs text-stone">&rarr;</span>
                        <span className="text-sm text-fjord">{link.property.name}</span>
                        <span className="ml-1 text-[10px] text-stone">({link.property.type})</span>
                      </div>
                      <button
                        onClick={() => deleteAcctPropLink(link.id)}
                        className="ml-2 shrink-0 text-xs text-stone hover:text-ember"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new link */}
              {linkMsg && (
                <p className="mb-2 text-sm text-ember">{linkMsg}</p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone">Account</label>
                  <select
                    value={newLinkAccountId}
                    onChange={(e) => setNewLinkAccountId(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">Select account</option>
                    {initialAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone">Property</label>
                  <select
                    value={newLinkPropertyId}
                    onChange={(e) => setNewLinkPropertyId(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">Select property</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={createAcctPropLink}
                  disabled={linkSaving || !newLinkAccountId || !newLinkPropertyId}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {linkSaving ? 'Linking...' : 'Link'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Data Tools */}
      <section className="card">
        <h2 className="mb-4 text-base font-semibold text-fjord">Data Tools</h2>

        {/* Fix Classifications */}
        <div className="mb-5">
          <h3 className="mb-1 text-sm font-semibold text-fjord">Fix Transaction Classifications</h3>
          <p className="mb-3 text-sm text-stone">
            Recalculates income/expense/transfer classification for all transactions based on category groups.
            Run this after importing or if totals look off.
          </p>
          {fixMsg && (
            <p className={`mb-2 text-sm ${fixMsg.type === 'success' ? 'text-income' : 'text-expense'}`}>
              {fixMsg.text}
            </p>
          )}
          <button
            onClick={fixClassifications}
            disabled={fixingClassification}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {fixingClassification ? 'Fixing...' : 'Fix Classifications'}
          </button>
        </div>

        <hr className="my-5 border-mist" />

        {/* Nuke & Reset */}
        <div>
          <h3 className="mb-1 text-sm font-semibold text-ember">Reset All Data</h3>
          <p className="mb-3 text-sm text-stone">
            Deletes all your transactions, accounts, budgets, debts, and categories.
            Your login stays intact so you can start fresh.
          </p>
          {resetMsg && (
            <p className={`mb-2 text-sm ${resetMsg.type === 'success' ? 'text-income' : 'text-expense'}`}>
              {resetMsg.text}
            </p>
          )}
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="btn-danger text-sm"
            >
              Nuke All Data
            </button>
          ) : (
            <div className="rounded-lg border border-ember/30 bg-ember/5 p-4">
              <p className="mb-3 text-sm font-medium text-fjord">
                This will permanently delete all your financial data. Your account will remain but all
                transactions, accounts, budgets, debts, categories, and settings will be wiped clean.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={resetAllData}
                  disabled={resetting}
                  className="btn-danger text-sm disabled:opacity-50"
                >
                  {resetting ? 'Resetting...' : 'Yes, Delete Everything'}
                </button>
                <button
                  onClick={() => { setShowResetConfirm(false); setResetMsg(null) }}
                  className="text-sm text-stone hover:text-fjord"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* R10.6: Delete Account */}
      <section className="card border-ember/30">
        <h2 className="mb-2 text-base font-semibold text-ember">Danger Zone</h2>
        <p className="mb-4 text-sm text-stone">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-danger text-sm"
          >
            Delete My Account
          </button>
        ) : (
          <div className="rounded-lg border border-ember/30 bg-ember/5 p-4">
            <p className="mb-3 text-sm font-medium text-fjord">
              Enter your password to confirm permanent account deletion:
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="input mb-3 max-w-sm text-sm"
              placeholder="Your password"
            />
            {deleteMsg && <p className="mb-2 text-sm text-expense">{deleteMsg}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePassword}
                className="btn-danger text-sm disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Permanently Delete Account'}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteMsg(null) }}
                className="text-sm text-stone hover:text-fjord"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
