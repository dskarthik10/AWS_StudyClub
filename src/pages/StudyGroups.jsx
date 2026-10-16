import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Mail } from 'lucide-react';
import { groupService } from '../services/groupService';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import CreateGroupModal from '../components/CreateGroupModal';
import './StudyGroups.css';

export default function StudyGroups() {
  const [myGroups, setMyGroups] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const [my, myInvites] = await Promise.all([
        groupService.getMyGroups(),
        groupService.getMyInvites(),
      ]);
      setMyGroups(my);
      setInvites(myInvites);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (clubId) => {
    try {
      await groupService.acceptInvite(clubId);
      setToast({ message: 'Invitation accepted!', type: 'success' });
      loadGroups();
    } catch (error) {
      setToast({ message: `Failed to accept invitation: ${error.message}`, type: 'error' });
    }
  };

  const handleDeclineInvite = async (clubId) => {
    try {
      await groupService.declineInvite(clubId);
      setToast({ message: 'Invitation declined', type: 'info' });
      loadGroups();
    } catch (error) {
      setToast({ message: `Failed to decline invitation: ${error.message}`, type: 'error' });
    }
  };

  const handleCreateGroup = async (formData) => {
    try {
      const result = await groupService.createGroup(
        formData.name,
        formData.subject,
        formData.description
      );
      setToast({ message: 'Group created successfully!', type: 'success' });
      loadGroups();
      if (result.clubId) {
        navigate(`/study-groups/${result.clubId}`);
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      setToast({ message: `Failed to create group: ${error.message}`, type: 'error' });
      throw error;
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading study groups..." />;
  }

  return (
    <div className="study-groups">
      <div className="page-header">
        <div>
          <h1>Study Groups</h1>
          <p>Learn together, share knowledge and stay accountable</p>
        </div>
        <button className="create-group-btn" onClick={() => setShowCreateModal(true)}>
          <Plus size={20} /> Create Group
        </button>
      </div>

      <div className="groups-container">
        {invites.length > 0 && (
          <section className="groups-section">
            <h2>
              <Mail size={20} /> Invitations ({invites.length})
            </h2>
            <div className="invites-list">
              {invites.map((inv) => (
                <div key={inv.clubId} className="invite-card">
                  <div className="group-avatar">📨</div>
                  <div className="group-info">
                    <h3>{inv.clubName}</h3>
                    <p className="group-subject">{inv.clubSubject}</p>
                    <p className="invite-by">
                      Invited by {inv.invitedByName || 'a group member'}
                    </p>
                  </div>
                  <div className="invite-actions">
                    <button className="join-btn" onClick={() => handleAcceptInvite(inv.clubId)}>
                      Accept
                    </button>
                    <button className="view-btn" onClick={() => handleDeclineInvite(inv.clubId)}>
                      Decline
                    </button>
                    <button
                      className="view-btn"
                      onClick={() => navigate(`/study-groups/${inv.clubId}`)}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="groups-section">
          <h2>
            <Users size={20} /> My Groups ({myGroups.length})
          </h2>
          {myGroups.length === 0 ? (
            <div className="empty-groups">
              <p>You haven't joined any study groups yet</p>
            </div>
          ) : (
            <div className="groups-grid">
              {myGroups.map((group) => (
                <div
                  key={group.id}
                  className="group-card"
                  onClick={() => navigate(`/study-groups/${group.id}`)}
                >
                  <div className="group-avatar">{group.avatar}</div>
                  <div className="group-info">
                    <h3>{group.name}</h3>
                    <p className="group-subject">{group.subject}</p>
                    <p className="group-description">{group.description}</p>
                    <div className="group-meta">
                      <span>👥 {group.members} members</span>
                      <span className={`activity-status ${group.isActive ? 'active' : ''}`}>
                        {group.isActive ? '🟢 Active' : '⚫ Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateGroup}
        />
      )}
    </div>
  );
}
