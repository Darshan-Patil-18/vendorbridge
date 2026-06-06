import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { 
  Activity, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Send, 
  User,
  Filter,
  Calendar,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import './SharedPages.css';

function ActivityLogs({ user, onLogout }) {
  const [filterType, setFilterType] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const activitiesList = data.map(log => {
        // Determine icon and color based on action
        let icon = Activity;
        let color = 'primary';

        if (log.action.includes('Created') || log.action.includes('Added')) {
          icon = Plus;
          color = 'success';
        } else if (log.action.includes('Updated') || log.action.includes('Edited')) {
          icon = Edit;
          color = 'info';
        } else if (log.action.includes('Deleted') || log.action.includes('Rejected')) {
          icon = Trash2;
          color = 'danger';
        } else if (log.action.includes('Approved') || log.action.includes('Generated')) {
          icon = CheckCircle;
          color = 'success';
        } else if (log.action.includes('Submitted') || log.action.includes('Sent')) {
          icon = Send;
          color = 'primary';
        }

        return {
          id: log.id,
          title: log.action,
          description: log.description,
          user: log.user_name,
          timestamp: formatDate(log.created_at) + ' ' + new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          icon: icon,
          color: color,
          type: log.action.toLowerCase().replace(/\s/g, '_'),
          date: new Date(log.created_at)
        };
      });

      setActivities(activitiesList);
    } catch (error) {
      console.error('Error fetching activities:', error);
      alert('Error loading activity logs');
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = activities.filter(activity => {
    // Filter by type
    if (filterType !== 'all') {
      const typeMatch = activity.type.includes(filterType);
      if (!typeMatch) return false;
    }

    // Filter by date
    if (filterDate !== 'all') {
      const now = new Date();
      const activityDate = activity.date;
      
      if (filterDate === 'today') {
        const isToday = activityDate.toDateString() === now.toDateString();
        if (!isToday) return false;
      } else if (filterDate === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (activityDate < weekAgo) return false;
      } else if (filterDate === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (activityDate < monthAgo) return false;
      }
    }

    return true;
  });

  const activityTypes = [
    { value: 'all', label: 'All Activities' },
    { value: 'created', label: 'Created' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'generated', label: 'Generated' },
    { value: 'updated', label: 'Updated' },
    { value: 'deleted', label: 'Deleted' }
  ];

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="activity-logs">
        <div className="page-header">
          <div>
            <h1>Activity Logs & Notifications</h1>
            <p>Track all procurement activities and updates</p>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <div className="filter-group">
            <Filter size={18} />
            <select
              className="form-control"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              {activityTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <Calendar size={18} />
            <select
              className="form-control"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading activity logs...</p>
          </div>
        ) : (
          <div className="activity-timeline">
          {filteredActivities.map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="activity-item">
                <div className={`activity-icon icon-${activity.color}`}>
                  <Icon size={20} />
                </div>
                
                <div className="activity-content">
                  <div className="activity-header">
                    <h4>{activity.title}</h4>
                    <span className="activity-time">{activity.timestamp}</span>
                  </div>
                  <p className="activity-description">{activity.description}</p>
                  <div className="activity-user">
                    <User size={14} />
                    <span>{activity.user}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {!loading && filteredActivities.length === 0 && activities.length === 0 && (
          <div className="empty-state">
            <Activity size={48} />
            <h3>No activity yet</h3>
            <p>Activity logs will appear here as you use the system</p>
          </div>
        )}

        {!loading && filteredActivities.length === 0 && activities.length > 0 && (
          <div className="empty-state">
            <Activity size={48} />
            <h3>No activities found</h3>
            <p>Try adjusting your filters</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ActivityLogs;
