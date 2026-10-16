import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, MessageSquare, BookOpen, Send, ThumbsUp, Plus, UserPlus, Check, X, Trash2, Bookmark } from 'lucide-react';
import { groupService } from '../services/groupService';
import { resourceService } from '../services/resourceService';
import { useAuth } from '../auth/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import ShareResourceModal from '../components/ShareResourceModal';
import AddMembersModal from '../components/AddMembersModal';
import './StudyGroupDetails.css';

export default function StudyGroupDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [activeTab, setActiveTab] = useState('discussion');
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [newComment, setNewComment] = useState({});
  const [toast, setToast] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [clubInvites, setClubInvites] = useState([]);
  const [hasPendingInvite, setHasPendingInvite] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [savedMap, setSavedMap] = useState({});

  useEffect(() => {
    loadGroupData();
  }, [id]);

  const loadGroupData = async () => {
    setLoading(true);
    try {
      const groupData = await groupService.getGroupById(id);
      const groupPosts = await groupService.getGroupPosts(id);
      const groupMembers = await groupService.getGroupMembers(id);
      const groupResources = await groupService.getGroupResources(id);
      setGroup(groupData);
      setPosts(groupPosts);
      setMembers(groupMembers);
      setResources(groupResources);

      const canManage = ['OWNER', 'ADMIN'].includes((groupData.userRole || '').toUpperCase());
      if (canManage) {
        setClubInvites(await groupService.getGroupInvites(id));
      } else {
        setClubInvites([]);
      }

      const myInvites = await groupService.getMyInvites();
      setHasPendingInvite(myInvites.some(inv => inv.clubId === id));
    } catch (error) {
      console.error('Error loading group:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLikePost = async (postId) => {
    try {
      await groupService.likePost(postId);
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, likes: post.isLiked ? post.likes - 1 : post.likes + 1, isLiked: !post.isLiked }
          : post
      ));
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleJoinGroup = async () => {
    try {
      await groupService.joinGroup(group.id);
      setToast({ message: 'Joined group successfully!', type: 'success' });
      await loadGroupData();
    } catch (error) {
      console.error('Failed to join group:', error);
      setToast({ message: `Failed to join group: ${error.message}`, type: 'error' });
    }
  };

  const handleAcceptInvite = async () => {
    try {
      await groupService.acceptInvite(id);
      setToast({ message: 'Invitation accepted!', type: 'success' });
      await loadGroupData();
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      setToast({ message: `Failed to accept invitation: ${error.message}`, type: 'error' });
    }
  };

  const handleDeclineInvite = async () => {
    try {
      await groupService.declineInvite(id);
      setToast({ message: 'Invitation declined', type: 'info' });
      await loadGroupData();
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      setToast({ message: `Failed to decline invitation: ${error.message}`, type: 'error' });
    }
  };

  const handleInvited = () => {
    setToast({ message: 'Invitation sent!', type: 'success' });
    groupService.getGroupInvites(id).then(setClubInvites).catch(() => {});
  };

  const handleDeleteGroup = async () => {
    setDeleting(true);
    try {
      await groupService.deleteGroup(group.id);
      setShowDeleteConfirm(false);
      navigate('/study-groups');
    } catch (error) {
      console.error('Failed to delete group:', error);
      setDeleting(false);
      setShowDeleteConfirm(false);
      setToast({ message: `Failed to delete group: ${error.message}`, type: 'error' });
    }
  };

  const handleAddPost = async () => {
    if (!newPost.trim()) return;

    try {
      await groupService.addPost(id, newPost);
      setToast({ message: 'Post added successfully!', type: 'success' });
      setNewPost('');
      loadGroupData();
    } catch (error) {
      console.error('Failed to add post:', error);
      setToast({ message: `Failed to add post: ${error.message}`, type: 'error' });
    }
  };

  const handleAddComment = async (postId) => {
    const content = newComment[postId];
    if (!content?.trim()) return;

    try {
      await groupService.addComment(postId, content);
      setToast({ message: 'Comment added!', type: 'success' });
      setNewComment(prev => ({ ...prev, [postId]: '' }));
      loadGroupData();
    } catch {
      setToast({ message: 'Failed to add comment', type: 'error' });
    }
  };

  const handleShareResource = async (resourceId) => {
    try {
      await groupService.shareResourceWithGroup(id, resourceId);
      setToast({ message: 'Resource shared successfully!', type: 'success' });
      setShowShareModal(false);
      loadGroupData();
    } catch (error) {
      console.error('Failed to share resource:', error);
      setToast({ message: `Failed to share resource: ${error.message}`, type: 'error' });
    }
  };

  const handleDownloadResource = async (s3Key) => {
    try {
      await resourceService.downloadResource(s3Key);
    } catch (error) {
      console.error('Failed to download resource:', error);
      setToast({ message: 'Failed to download resource', type: 'error' });
    }
  };

  const handleSaveToLibrary = async (resource) => {
    if (savingId) return;

    setSavingId(resource.id);

    try {
      await resourceService.saveResource(resource.id, { clubId: id });
      setSavedMap(prev => ({ ...prev, [resource.id]: true }));
      setToast({ message: 'Saved to your library', type: 'success' });
    } catch (error) {
      console.error('Failed to save resource:', error);
      setToast({ message: `Failed to save resource: ${error.message}`, type: 'error' });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading group..." />;
  }

  if (!group) {
    return (
      <div className="study-group-details">
        <div className="error-state">
          <h2>Group not found</h2>
          <button onClick={() => navigate('/study-groups')}>Back to Study Groups</button>
        </div>
      </div>
    );
  }

  const isAdmin = ['OWNER', 'ADMIN'].includes((group.userRole || '').toUpperCase());

  return (
    <div className="study-group-details">
      <button className="back-btn" onClick={() => navigate('/study-groups')}>
        <ArrowLeft size={20} /> Back to Groups
      </button>

      <div className="group-header">
        <div className="group-avatar-large">{group.avatar}</div>
        <div className="group-header-info">
          <h1>{group.name}</h1>
          <p className="group-subject-tag">{group.subject}</p>
          <p className="group-description-full">{group.description}</p>
          <div className="group-stats">
            <span>👥 {group.members} members</span>
            <span>📅 Created {group.createdDate}</span>
            <span className={`activity-status ${group.isActive ? 'active' : ''}`}>
              {group.isActive ? '🟢 Active' : '⚫ Inactive'}
            </span>
          </div>
        </div>
        {!group.isJoined && hasPendingInvite && (
          <div className="invite-response-actions">
            <button className="join-group-btn" onClick={handleAcceptInvite}>
              <Check size={18} /> Accept Invitation
            </button>
            <button className="decline-invite-btn" onClick={handleDeclineInvite}>
              <X size={18} /> Decline
            </button>
          </div>
        )}
        {!group.isJoined && !hasPendingInvite && (
          <button className="join-group-btn" onClick={handleJoinGroup}>
            Join Group
          </button>
        )}
        {isAdmin && (
          <button className="delete-group-btn" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 size={18} /> Delete Group
          </button>
        )}
      </div>

      <div className="group-tabs">
        <button
          className={`tab-btn ${activeTab === 'discussion' ? 'active' : ''}`}
          onClick={() => setActiveTab('discussion')}
        >
          <MessageSquare size={18} /> Discussion
        </button>
        <button
          className={`tab-btn ${activeTab === 'resources' ? 'active' : ''}`}
          onClick={() => setActiveTab('resources')}
        >
          <BookOpen size={18} /> Resources
        </button>
        <button
          className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          <Users size={18} /> Members
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'discussion' && (
          <div className="discussion-tab">
            {group.isJoined ? (
            <div className="new-post-box">
              <textarea
                placeholder="Share your thoughts with the group..."
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                rows="3"
              />
              <button
                className="post-btn"
                onClick={handleAddPost}
                disabled={!newPost.trim()}
              >
                <Send size={18} /> Post
              </button>
            </div>
            ) : (
              <div className="empty-posts join-prompt">
                <Users size={48} />
                <p>Join this group to start discussing.</p>
              </div>
            )}

            <div className="posts-list">
              {posts.length === 0 ? (
                <div className="empty-posts">
                  <MessageSquare size={48} />
                  <p>No discussions yet. Be the first to start one!</p>
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="post-card">
                    <div className="post-header">
                      <div className="post-author-avatar">{post.avatar}</div>
                      <div className="post-author-info">
                        <strong>{post.author}</strong>
                        <span className="post-time">{post.time}</span>
                      </div>
                    </div>
                    <p className="post-content">{post.content}</p>
                    <div className="post-actions">
                      <button
                        className={`like-btn ${post.isLiked ? 'liked' : ''}`}
                        onClick={() => handleLikePost(post.id)}
                      >
                        <ThumbsUp size={16} /> {post.likes}
                      </button>
                      <span className="comment-count">
                        💬 {post.comments.length} comments
                      </span>
                    </div>

                    {post.comments.length > 0 && (
                      <div className="comments-list">
                        {post.comments.map((comment) => (
                          <div key={comment.id} className="comment">
                            <strong>{comment.author}</strong>
                            <p>{comment.content}</p>
                            <span className="comment-time">{comment.time}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="add-comment">
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={newComment[post.id] || ''}
                        onChange={(e) => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={!newComment[post.id]?.trim()}
                      >
                        Comment
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="resources-tab">
            <div className="resources-header">
              {group.isJoined && (
                <button className="share-resource-btn" onClick={() => setShowShareModal(true)}>
                  <Plus size={18} /> Share Resource
                </button>
              )}
              {!group.isJoined && (
                <p className="share-resource-prompt">Join this group to share resources.</p>
              )}
            </div>
            {resources.length === 0 ? (
              <div className="empty-posts">
                <BookOpen size={48} />
                <p>No resources shared yet. Share your first resource!</p>
              </div>
            ) : (
              <div className="resources-list">
                {resources.map((resource) => {
                  const ownsResource =
                    resource.isOwner ||
                    (Boolean(user?.id) && resource.ownerId === user.id);
                  const isSaved = savedMap[resource.id] ?? resource.saved;
                  const isSaving = savingId === resource.id;

                  return (
                    <div key={resource.id} className="resource-card">
                      <div className="resource-icon">📄</div>
                      <div className="resource-info">
                        <h4>{resource.title}</h4>
                        <p className="resource-meta">
                          {resource.type} • Uploaded by {resource.uploadedBy}
                        </p>
                        <span className="resource-date">{resource.uploadDate}</span>
                      </div>
                      <div className="resource-card-actions">
                        {!ownsResource && (
                          <button
                            className="save-library-btn"
                            onClick={() => handleSaveToLibrary(resource)}
                            disabled={isSaved || isSaving}
                          >
                            {isSaved ? (
                              <><Check size={16} /> Saved to Library</>
                            ) : isSaving ? (
                              'Saving...'
                            ) : (
                              <><Bookmark size={16} /> Save to Library</>
                            )}
                          </button>
                        )}
                        <button
                          className="download-btn"
                          onClick={() => handleDownloadResource(resource.s3Key)}
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="members-tab">
            {isAdmin && (
              <div className="members-header-actions">
                <button className="add-members-btn" onClick={() => setShowAddMembers(true)}>
                  <UserPlus size={18} /> Add Members
                </button>
              </div>
            )}

            {isAdmin && clubInvites.length > 0 && (
              <div className="pending-invites-block">
                <h4>Pending Invitations ({clubInvites.length})</h4>
                <div className="pending-invites-list">
                  {clubInvites.map((inv) => (
                    <div key={inv.userId} className="pending-invite-item">
                      <span className="pending-invite-name">{inv.name}</span>
                      <span className="pending-invite-status">
                        Invited by {inv.invitedByName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {members.length === 0 ? (
              <div className="empty-posts">
                <Users size={48} />
                <p>No members yet.</p>
              </div>
            ) : (
              <div className="members-grid">
                {members.map((member) => (
                  <div key={member.id} className="member-card">
                    <div className="member-avatar">{member.avatar}</div>
                    <div className="member-info">
                      <strong>{member.name}</strong>
                      <span className="member-role">{member.role}</span>
                      <span className="member-joined">Joined {member.joinedDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {showShareModal && (
        <ShareResourceModal
          clubId={id}
          onClose={() => setShowShareModal(false)}
          onShare={handleShareResource}
        />
      )}
      {showAddMembers && (
        <AddMembersModal
          clubId={id}
          existingMemberIds={members.map(m => m.id)}
          pendingInviteIds={clubInvites.map(inv => inv.userId)}
          onClose={() => setShowAddMembers(false)}
          onInvited={handleInvited}
        />
      )}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => !deleting && setShowDeleteConfirm(false)}
        title="Delete Study Group"
        size="sm"
      >
        <p className="delete-confirm-text">
          Are you sure you want to delete <strong>{group.name}</strong>? The group will be
          archived and removed from your list. Existing messages, members and shared resources
          are preserved.
        </p>
        <div className="delete-confirm-actions">
          <button
            className="confirm-cancel-btn"
            onClick={() => setShowDeleteConfirm(false)}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            className="confirm-delete-btn"
            onClick={handleDeleteGroup}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Group'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
