import { useState } from 'react'
import type { RoomMember } from '../../hooks/useRoomMembers'
import MembersList from './MembersList'

interface Props {
  members: RoomMember[]
  currentUserId?: string
  onRemove?: (userId: string) => Promise<boolean>
  onLeave?: () => void
  onLogout?: () => void
  onClose: () => void
}

export default function MembersPanel({ members, currentUserId, onRemove, onLeave, onLogout, onClose }: Props) {
  const [confirmLeave, setConfirmLeave] = useState(false)

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="members-panel-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-grayCustom border border-[#333333] w-full max-w-sm shadow-2xl">
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <h2 id="members-panel-title" className="text-2xl font-bold text-white">
              Room members
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close members list"
              className="text-gray-500 hover:text-white transition-colors text-lg leading-none mt-1"
            >
              ✕
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <MembersList members={members} currentUserId={currentUserId} onRemove={onRemove} />
          </div>
          {currentUserId && (onLeave || onLogout) && (
            <div className="mt-5 pt-4 border-t border-[#333333]">
              {confirmLeave ? (
                <div>
                  <p className="text-sm text-gray-400 mb-3">Are you sure? You'll be removed from this room.</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(false)}
                      className="flex-1 text-xs font-display uppercase border border-[#555] text-gray-400 hover:text-white hover:border-white px-3 py-2 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={onLeave}
                      className="flex-1 text-xs font-display uppercase bg-red text-white hover:opacity-90 px-3 py-2 transition-colors"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  {onLeave && (
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(true)}
                      className="flex-1 text-xs font-display uppercase bg-red text-white hover:opacity-90 px-3 py-2 transition-colors"
                    >
                      Leave Room
                    </button>
                  )}
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="flex-1 text-xs font-display uppercase border border-[#555] text-gray-400 hover:text-white hover:border-white px-3 py-2 transition-colors"
                    >
                      Log Out
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
