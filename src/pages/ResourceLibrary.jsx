import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Download, Eye, Bookmark, Trash2 } from 'lucide-react';
import { resourceService } from '../services/resourceService';
import { subjects, resourceTypes, semesters } from '../data/mockResources';
import { useAuth } from '../auth/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import './ResourceLibrary.css';

export default function ResourceLibrary() {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedOverrides, setSavedOverrides] = useState({});
  const [filters, setFilters] = useState({
    subject: 'All Subjects',
    type: 'All Types',
    semester: 'All Semesters',
    sortBy: 'newest',
  });
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadResources();
  }, [filters, searchQuery]);

  const loadResources = async () => {
    setLoading(true);

    try {
      const data = await resourceService.getResources({
        ...filters,
        search: searchQuery,
      });

      setResources(data);
    } catch (error) {
      console.error('Error loading resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      subject: 'All Subjects',
      type: 'All Types',
      semester: 'All Semesters',
      sortBy: 'newest',
    });

    setSearchQuery('');
  };

  const hasActiveFilters =
    filters.subject !== 'All Subjects' ||
    filters.type !== 'All Types' ||
    filters.semester !== 'All Semesters' ||
    searchQuery !== '';

  // The backend is the source of truth for authorization; this only controls
  // whether the Delete action is surfaced in the UI.
  const isOwner = (resource) =>
    Boolean(user?.id) && resource.ownerId === user.id;

  const isSaved = (resource) =>
    savedOverrides[resource.id] ?? Boolean(resource.saved);

  const handleBookmark = async (event, resource) => {
    event.stopPropagation();

    try {
      const result = await resourceService.saveResource(resource.id);
      setSavedOverrides(prev => ({ ...prev, [resource.id]: true }));
      setToast({
        message:
          result?.alreadySaved || result?.alreadyOwned
            ? 'Already in your library'
            : 'Saved to your library',
        type: 'success',
      });
    } catch (error) {
      console.error('Error saving resource:', error);
      setToast({
        message: error.message || 'Failed to save resource',
        type: 'error',
      });
    }
  };

  const handleDeleteClick = (event, resource) => {
    event.stopPropagation();
    setDeleteTarget(resource);
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);

    try {
      await resourceService.deleteResource(deleteTarget.id);
      setDeleteTarget(null);
      await loadResources();
      setToast({ message: 'Resource deleted successfully', type: 'success' });
    } catch (error) {
      console.error('Error deleting resource:', error);
      setToast({
        message: error.message || 'Failed to delete resource',
        type: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="resource-library">

      <div className="page-header">
        <div>
          <h1>Resource Library</h1>
          <p>
            Find notes, guides and study materials shared by your community
          </p>
        </div>
      </div>

      <div className="search-filter-bar">

        <div className="search-box">
          <Search size={20} />

          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Filters button */}
        <button
          className="filter-toggle"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} />
          Filters

          {hasActiveFilters && (
            <span className="filter-badge"></span>
          )}
        </button>

      </div>

      {showFilters && (
        <div className="filters-panel">

          <div className="filter-group">
            <label>Subject</label>

            <select
              value={filters.subject}
              onChange={(e) =>
                handleFilterChange('subject', e.target.value)
              }
            >
              {subjects.map(subject => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Type</label>

            <select
              value={filters.type}
              onChange={(e) =>
                handleFilterChange('type', e.target.value)
              }
            >
              {resourceTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Semester</label>

            <select
              value={filters.semester}
              onChange={(e) =>
                handleFilterChange('semester', e.target.value)
              }
            >
              {semesters.map(semester => (
                <option key={semester} value={semester}>
                  {semester}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Sort By</label>

            <select
              value={filters.sortBy}
              onChange={(e) =>
                handleFilterChange('sortBy', e.target.value)
              }
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="popular">Most Downloads</option>
              <option value="liked">Most Liked</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              className="clear-filters"
              onClick={handleClearFilters}
            >
              Clear All Filters
            </button>
          )}

        </div>
      )}

      <div className="results-info">
        <p>{resources.length} resources found</p>
      </div>

      {loading ? (

        <LoadingSpinner text="Loading resources..." />

      ) : resources.length === 0 ? (

        <EmptyState
          icon="📚"
          title="No resources found"
          message="Try adjusting your filters or search query"
          action={{
            label: 'Clear Filters',
            onClick: handleClearFilters,
          }}
        />

      ) : (

        <div className="resources-grid">

          {resources.map((resource) => (

            <div
              key={resource.id}
              className="resource-card"
              onClick={() =>
                navigate(`/resources/${resource.id}`)
              }
            >

              <div className="resource-card-header">

                <div className="resource-type-badge">
                  {resource.type}
                </div>

                {!isOwner(resource) && (
                  isSaved(resource) ? (
                    <span className="saved-badge">Saved</span>
                  ) : (
                    <button
                      className="bookmark-btn"
                      title="Save to library"
                      onClick={(e) => handleBookmark(e, resource)}
                    >
                      <Bookmark size={18} />
                    </button>
                  )
                )}

              </div>

              <div className="resource-card-icon">
                📄
              </div>

              <h3 className="resource-card-title">
                {resource.title}
              </h3>

              <p className="resource-card-subject">
                {resource.subject}
              </p>

              <p className="resource-card-description">
                {resource.description}
              </p>

              <div className="resource-card-meta">
                <span>
                  👤 {resource.uploadedBy}
                </span>

                <span>
                  📅 {resource.uploadDate}
                </span>
              </div>

              <div className="resource-card-stats">

                <span>
                  <Download size={14} />
                  {resource.downloads}
                </span>

                <span>
                  ❤️ {resource.likes}
                </span>

                <span>
                  {resource.fileSize}
                </span>

              </div>

              <div className="resource-card-actions">

                {/* View */}
                <button
                  className="btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/resources/${resource.id}`);
                  }}
                >
                  <Eye size={16} />
                  View
                </button>

                {/* Download */}
                <button
                  className="btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    resourceService.downloadResource(
                      resource.s3Key
                    );
                  }}
                >
                  <Download size={16} />
                  Download
                </button>

                {/* Delete — only for resources owned by the signed-in user */}
                {isOwner(resource) && (
                  <button
                    className="btn-danger"
                    onClick={(e) => handleDeleteClick(e, resource)}
                    disabled={deleting && deleteTarget?.id === resource.id}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                )}

              </div>

            </div>

          ))}

        </div>

      )}

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={handleCancelDelete}
        title="Delete Resource?"
        size="sm"
      >
        <div className="delete-confirm">
          <p className="delete-confirm-message">
            Are you sure you want to permanently delete this resource?
            This action cannot be undone.
          </p>

          {deleteTarget?.sharedClubs?.length > 0 && (
            <p className="delete-confirm-warning">
              This resource is shared with {deleteTarget.sharedClubs.length}{' '}
              study group
              {deleteTarget.sharedClubs.length > 1 ? 's' : ''}. Deleting it
              will also remove it from those groups.
            </p>
          )}

          <div className="delete-confirm-actions">
            <button
              className="btn-secondary"
              onClick={handleCancelDelete}
              disabled={deleting}
            >
              Cancel
            </button>

            <button
              className="btn-danger"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {toast && (
        <Toast {...toast} onClose={() => setToast(null)} />
      )}

    </div>
  );
}