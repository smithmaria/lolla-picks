import type { RoomMember } from '../../hooks/useRoomMembers'
import MembersList from './MembersList'

interface Props {
  members: RoomMember[]
  currentUserId?: string
  onRemove?: (userId: string) => Promise<boolean>
  onClose: () => void
}

export default function MembersPanel({ members, currentUserId, onRemove, onClose }: Props) {
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
        </div>
      </div>
    </div>
  )
}
