import { useState, useEffect } from 'react';
import { X, Search, UserPlus, Check, Clock } from 'lucide-react';
import { groupService } from '../services/groupService';
import './AddMembersModal.css';

export default function AddMembersModal({ clubId, existingMemberIds = [], pendingInviteIds = [], onClose, onInvited }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [invitingId, setInvitingId] = useState(null);
  const [invitedIds, setInvitedIds] = useState(() => new Set(pendingInviteIds));

  const memberSet = new Set(existingMemberIds);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await groupService.searchUsers(q);
        if (active) {
          setResults(users);
          setError('');
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to search users');
          setResults([]);
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleInvite = async (user) => {
    setInvitingId(user.userId);
    setError('');
    try {
      await groupService.inviteMember(clubId, user.userId, user.name);
      setInvitedIds(prev => new Set(prev).add(user.userId));
      if (onInvited) onInvited(user);
    } catch (err) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <div className="add-members-overlay" onClick={onClose}>
      <div className="add-members-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-members-header">
          <h2>Add Members</h2>
          <button className="add-members-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="add-members-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {error && <p className="add-members-error">{error}</p>}

        <div className="add-members-results">
          {query.trim().length < 2 ? (
            <p className="add-members-hint">Type at least 2 characters to search registered users.</p>
          ) : searching ? (
            <p className="add-members-hint">Searching...</p>
          ) : results.length === 0 ? (
            <p className="add-members-hint">No users found.</p>
          ) : (
            results.map((user) => {
              const isMember = memberSet.has(user.userId);
              const isInvited = invitedIds.has(user.userId);
              const isInviting = invitingId === user.userId;
              return (
                <div key={user.userId} className="add-members-row">
                  <div className="add-members-avatar">
                    <UserPlus size={18} />
                  </div>
                  <div className="add-members-info">
                    <strong>{user.name || user.email}</strong>
                    <span>{user.email}</span>
                  </div>
                  {isMember ? (
                    <span className="add-members-badge">Member</span>
                  ) : isInvited ? (
                    <span className="add-members-badge invited">
                      <Check size={14} /> Invited
                    </span>
                  ) : (
                    <button
                      className="add-members-invite-btn"
                      onClick={() => handleInvite(user)}
                      disabled={isInviting}
                    >
                      {isInviting ? <Clock size={14} /> : <UserPlus size={14} />}
                      {isInviting ? 'Sending...' : 'Invite'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
