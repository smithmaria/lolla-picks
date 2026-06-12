import { useState } from 'react'
import type { RoomMember } from '../../hooks/useRoomMembers'

interface Props {
  members: RoomMember[]
  currentUserId?: string
  /** When set, non-admin members get a remove button */
  onRemove?: (userId: string) => Promise<boolean>
}

export default function MembersList({ members, currentUserId, onRemove }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRemove(userId: string) {
    if (!onRemove) return
    setRemovingId(userId)
    setError(null)
    const ok = await onRemove(userId)
    setRemovingId(null)
    setConfirmId(null)
    if (!ok) setError('Failed to remove member.')
  }

  if (members.length === 0) {
    return <p className="text-gray-500 text-sm">No one has joined yet.</p>
  }

  return (
    <div>
      <ul className="divide-y divide-[#333333] border border-[#333333]">
        {members.map(member => (
          <li
            key={member.id}
            className="flex items-center justify-between gap-3 px-3 py-2.5 bg-grayDark"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-white text-sm truncate">{member.display_name}</span>
              {member.is_admin && (
                <span className="text-[10px] font-display uppercase tracking-wider bg-yellow text-black px-1.5 py-0.5 shrink-0">
                  Admin
                </span>
              )}
              {member.id === currentUserId && (
                <span className="text-gray-500 text-xs shrink-0">(you)</span>
              )}
            </div>

            {onRemove && !member.is_admin && (
              confirmId === member.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    disabled={removingId === member.id}
                    className="text-xs font-display uppercase text-gray-400 hover:text-white px-2 py-1 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemove(member.id)}
                    disabled={removingId === member.id}
                    className="text-xs font-display uppercase bg-red text-white hover:opacity-90 disabled:opacity-50 px-2.5 py-1 transition-colors"
                  >
                    {removingId === member.id ? 'Removing…' : 'Confirm'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(member.id)}
                  aria-label={`Remove ${member.display_name} from the room`}
                  className="text-xs font-display uppercase text-red/75 hover:text-red px-2 py-1 transition-colors shrink-0"
                >
                  Remove
                </button>
              )
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  )
}
