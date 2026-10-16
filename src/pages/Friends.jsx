import { useState, useEffect } from 'react';
import { UserPlus, UserCheck, UserMinus, Search, Users, Inbox, Send, Check, X } from 'lucide-react';
import { friendsService } from '../services/friendsService';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import './Friends.css';

function initials(user) {
  const source = (user?.name || user?.email || '?').trim();
  return source.charAt(0).toUpperCase();
}

export default function Friends() {
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [friendsData, incomingData, outgoingData] = await Promise.all([
        friendsService.getFriends(),
        friendsService.getFriendRequests(),
        friendsService.getOutgoingRequests(),
      ]);
      setFriends(friendsData.friends || []);
      setIncoming(incomingData.requests || []);
      setOutgoing(outgoingData.requests || []);
    } catch (error) {
      console.error('Failed to load friends:', error);
      setToast({ message: `Failed to load friends: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const refreshRequests = async () => {
    try {
      const [incomingData, outgoingData] = await Promise.all([
        friendsService.getFriendRequests(),
        friendsService.getOutgoingRequests(),
      ]);
      setIncoming(incomingData.requests || []);
      setOutgoing(outgoingData.requests || []);
    } catch (error) {
      console.error('Failed to refresh requests:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchError('Enter at least 2 characters to search.');
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const data = await friendsService.searchUsers(query);
      setSearchResults(data.users || []);
      setSearched(true);
    } catch (error) {
      setSearchError(error.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (user) => {
    setActionId(user.userId);
    try {
      await friendsService.sendFriendRequest(user.userId);
      setSearchResults(prev => prev.map(u =>
        u.userId === user.userId ? { ...u, friendStatus: 'REQUEST_SENT' } : u
      ));
      setToast({ message: `Friend request sent to ${user.name || user.email}`, type: 'success' });
      refreshRequests();
    } catch (error) {
      setToast({ message: `Failed to send request: ${error.message}`, type: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const handleAccept = async (userId, name) => {
    setActionId(userId);
    try {
      await friendsService.acceptFriendRequest(userId);
      setToast({ message: `You are now friends with ${name || 'this user'}`, type: 'success' });
      setSearchResults(prev => prev.map(u =>
        u.userId === userId ? { ...u, friendStatus: 'CONFIRMED' } : u
      ));
      await loadAll();
    } catch (error) {
      setToast({ message: `Failed to accept request: ${error.message}`, type: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (userId) => {
    setActionId(userId);
    try {
      await friendsService.rejectFriendRequest(userId);
      setToast({ message: 'Request declined', type: 'info' });
      await refreshRequests();
    } catch (error) {
      setToast({ message: `Failed to decline request: ${error.message}`, type: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const handleRemoveFriend = async (userId, name) => {
    setActionId(userId);
    try {
      await friendsService.removeFriend(userId);
      setToast({ message: `Removed ${name || 'friend'}`, type: 'info' });
      setFriends(prev => prev.filter(f => f.userId !== userId));
    } catch (error) {
      setToast({ message: `Failed to remove friend: ${error.message}`, type: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const renderSearchAction = (user) => {
    const busy = actionId === user.userId;
    switch (user.friendStatus) {
      case 'CONFIRMED':
        return <span className="friend-badge"><UserCheck size={14} /> Friends</span>;
      case 'REQUEST_SENT':
        return <span className="friend-badge"><Send size={14} /> Request Sent</span>;
      case 'REQUEST_RECEIVED':
        return (
          <button className="friend-btn primary" onClick={() => handleAccept(user.userId, user.name)} disabled={busy}>
            <Check size={14} /> Accept
          </button>
        );
      default:
        return (
          <button className="friend-btn primary" onClick={() => handleSendRequest(user)} disabled={busy}>
            <UserPlus size={14} /> {busy ? 'Sending...' : 'Add Friend'}
          </button>
        );
    }
  };

  return (
    <div className="friends-page">
      <div className="page-header">
        <div>
          <h1>Friends</h1>
          <p>Find study partners and manage your friend requests</p>
        </div>
      </div>

      <section className="friends-search-section">
        <form className="friends-search-form" onSubmit={handleSearch}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>
        {searchError && <p className="friends-error">{searchError}</p>}

        {searchResults.length > 0 && (
          <div className="friends-search-results">
            {searchResults.map((user) => (
              <div key={user.userId} className="friend-row">
                <div className="friend-avatar">{initials(user)}</div>
                <div className="friend-info">
                  <strong>{user.name || user.email}</strong>
                  <span>{user.email}</span>
                </div>
                {renderSearchAction(user)}
              </div>
            ))}
          </div>
        )}
        {searched && !searching && !searchError && searchResults.length === 0 && (
          <p className="friends-empty">No users found matching your search.</p>
        )}
      </section>

      {loading ? (
        <LoadingSpinner text="Loading friends..." />
      ) : (
        <>
          <section className="friends-section">
            <h2><Inbox size={20} /> Incoming Requests ({incoming.length})</h2>
            {incoming.length === 0 ? (
              <p className="friends-empty">No incoming friend requests.</p>
            ) : (
              <div className="friends-list">
                {incoming.map((req) => (
                  <div key={req.fromUserId} className="friend-row">
                    <div className="friend-avatar">{initials({ name: req.fromUserName })}</div>
                    <div className="friend-info">
                      <strong>{req.fromUserName || 'Registered user'}</strong>
                    </div>
                    <div className="friend-actions">
                      <button
                        className="friend-btn primary"
                        onClick={() => handleAccept(req.fromUserId, req.fromUserName)}
                        disabled={actionId === req.fromUserId}
                      >
                        <Check size={14} /> Accept
                      </button>
                      <button
                        className="friend-btn"
                        onClick={() => handleDecline(req.fromUserId)}
                        disabled={actionId === req.fromUserId}
                      >
                        <X size={14} /> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="friends-section">
            <h2><Send size={20} /> Outgoing Requests ({outgoing.length})</h2>
            {outgoing.length === 0 ? (
              <p className="friends-empty">No outgoing friend requests.</p>
            ) : (
              <div className="friends-list">
                {outgoing.map((req) => (
                  <div key={req.toUserId} className="friend-row">
                    <div className="friend-avatar">{initials({ name: req.toUserName })}</div>
                    <div className="friend-info">
                      <strong>{req.toUserName || 'Registered user'}</strong>
                      <span>{req.toUserEmail}</span>
                    </div>
                    <span className="friend-badge"><Send size={14} /> Pending</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="friends-section">
            <h2><Users size={20} /> My Friends ({friends.length})</h2>
            {friends.length === 0 ? (
              <p className="friends-empty">You haven't added any friends yet.</p>
            ) : (
              <div className="friends-list">
                {friends.map((friend) => (
                  <div key={friend.userId} className="friend-row">
                    <div className="friend-avatar">{initials(friend)}</div>
                    <div className="friend-info">
                      <strong>{friend.name || friend.email}</strong>
                      <span>{friend.email}</span>
                    </div>
                    <button
                      className="friend-btn danger"
                      onClick={() => handleRemoveFriend(friend.userId, friend.name)}
                      disabled={actionId === friend.userId}
                    >
                      <UserMinus size={14} /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
