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
}

interface Props {
  user: { name: string; email: string; createdAt: string }
  initialMembers: Member[]
  initialProperties: Property[]
}

export default function SettingsClient({ user, initialMembers, initialProperties }: Props) {
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
  const [newPropType, setNewPropType] = useState<'PERSONAL' | 'RENTAL'>('PERSONAL')
  const [propSaving, setPropSaving] = useState(false)
  const [propMsg, setPropMsg] = useState<string | null>(null)

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
  async function addProperty() {
    const trimmed = newPropName.trim()
    if (!trimmed || propSaving) return
    setPropSaving(true)
    setPropMsg(null)
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, type: newPropType }),
      })
      if (!res.ok) {
        const data = await res.json()
        setPropMsg(data.error ?? 'Failed to add property.')
        return
      }
      const prop = await res.json()
      setProperties((prev) => [...prev, prop])
      setNewPropName('')
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

      {/* R10.3: Properties */}
      <section className="card">
        <h2 className="mb-4 text-base font-semibold text-fjord">Properties</h2>
        {properties.length === 0 ? (
          <p className="mb-3 text-sm text-stone">No properties yet.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {properties.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-mist bg-snow px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fjord">{p.name}</span>
                  <span className="rounded-badge bg-frost px-1.5 py-0.5 text-[10px] font-medium text-stone">
                    {p.type === 'RENTAL' ? 'Rental' : 'Personal'}
                  </span>
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
              </li>
            ))}
          </ul>
        )}
        {propMsg && <p className="mb-2 text-sm text-expense">{propMsg}</p>}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newPropName}
            onChange={(e) => setNewPropName(e.target.value)}
            className="input flex-1 text-sm"
            placeholder="Property name"
            onKeyDown={(e) => e.key === 'Enter' && addProperty()}
          />
          <select
            value={newPropType}
            onChange={(e) => setNewPropType(e.target.value as 'PERSONAL' | 'RENTAL')}
            className="input w-32 text-sm"
          >
            <option value="PERSONAL">Personal</option>
            <option value="RENTAL">Rental</option>
          </select>
          <button onClick={addProperty} disabled={propSaving || !newPropName.trim()} className="btn-primary text-sm">
            {propSaving ? 'Adding...' : 'Add'}
          </button>
        </div>
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
