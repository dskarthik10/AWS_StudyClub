import { useState } from 'react';
import { X } from 'lucide-react';
import './CreateGroupModal.css';

export default function CreateGroupModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const subjects = [
    'Computer Science',
    'Data Science',
    'Machine Learning',
    'Web Development',
    'Cloud Computing',
    'Database',
    'Artificial Intelligence',
    'Mathematics',
    'Physics',
    'Chemistry',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.subject) return;

    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-group-overlay" onClick={onClose}>
      <div className="create-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-group-header">
          <h2>Create Study Group</h2>
          <button className="create-group-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-group-form">
          <div className="create-group-field">
            <label htmlFor="name">Group Name *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Advanced ML Study Group"
              maxLength={100}
              required
            />
          </div>

          <div className="create-group-field">
            <label htmlFor="subject">Subject *</label>
            <select
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
            >
              <option value="">Select a subject</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          <div className="create-group-field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What will this group focus on?"
              rows="4"
              maxLength={500}
            />
          </div>

          <div className="create-group-actions">
            <button type="button" className="create-group-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="create-group-btn-primary"
              disabled={!formData.name.trim() || !formData.subject || submitting}
            >
              {submitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
