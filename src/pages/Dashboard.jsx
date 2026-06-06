import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  DollarSign, 
  FileText, 
  Users, 
  ShoppingCart,
  AlertCircle,
  ArrowUpRight,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import './Dashboard.css';

function Dashboard({ user, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    {
      label: 'Total RFQs',
      value: '0',
      icon: FileText,
      color: 'primary'
    },
    {
      label: 'Pending Approvals',
      value: '0',
      icon: Clock,
      color: 'warning'
    },
    {
      label: 'Active Vendors',
      value: '0',
      icon: Users,
      color: 'success'
    },
    {
      label: 'Total Spend',
      value: '$0',
      icon: DollarSign,
      color: 'info'
    }
  ]);

  const [recentRFQs, setRecentRFQs] = useState([]);
  const [recentPOs, setRecentPOs] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [monthlySpend, setMonthlySpend] = useState([]);
  const [categorySpend, setCategorySpend] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [
        rfqsCount,
        pendingApprovalsCount,
        activeVendorsCount,
        totalSpendData,
        rfqsData,
        posData,
        approvalsData,
        monthlySpendData
      ] = await Promise.all([
        supabase.from('rfqs').select('id', { count: 'exact', head: true }),
        supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('purchase_orders').select('total'),
        supabase.from('rfqs').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('approvals').select('*, rfqs(title), quotations(vendor_name, total_amount)').eq('status', 'pending').limit(5),
        supabase.from('purchase_orders').select('total, created_at').order('created_at', { ascending: false })
      ]);

      // Calculate total spend
      const totalSpend = totalSpendData.data?.reduce((sum, po) => sum + (Number(po.total) || 0), 0) || 0;

      // Update stats
      setStats([
        {
          label: 'Total RFQs',
          value: rfqsCount.count?.toString() || '0',
          icon: FileText,
          color: 'primary'
        },
        {
          label: 'Pending Approvals',
          value: pendingApprovalsCount.count?.toString() || '0',
          icon: Clock,
          color: 'warning'
        },
        {
          label: 'Active Vendors',
          value: activeVendorsCount.count?.toString() || '0',
          icon: Users,
          color: 'success'
        },
        {
          label: 'Total Spend',
          value: `$${totalSpend.toLocaleString()}`,
          icon: DollarSign,
          color: 'info'
        }
      ]);

      // Set recent RFQs
      setRecentRFQs(rfqsData.data?.map(rfq => ({
        id: rfq.id.substring(0, 8),
        title: rfq.title,
        status: rfq.status,
        deadline: formatDate(rfq.deadline),
        vendors: rfq.selected_vendors?.length || 0
      })) || []);

      // Set recent POs
      setRecentPOs(posData.data?.map(po => ({
        id: po.id.substring(0, 8),
        vendor: po.vendor_name,
        amount: `$${Number(po.total).toLocaleString()}`,
        date: formatDate(po.created_at),
        status: po.status
      })) || []);

      // Set pending approvals
      setPendingApprovals(approvalsData.data?.map(approval => ({
        id: approval.id.substring(0, 8),
        rfq: approval.rfqs?.title || 'N/A',
        amount: `$${Number(approval.quotations?.total_amount || 0).toLocaleString()}`,
        submittedBy: approval.quotations?.vendor_name || 'Unknown',
        date: formatDate(approval.created_at)
      })) || []);

      // Calculate monthly spend (last 6 months)
      if (monthlySpendData.data && monthlySpendData.data.length > 0) {
        const monthlyData = {};
        monthlySpendData.data.forEach(po => {
          const date = new Date(po.created_at);
          const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + Number(po.total);
        });

        const chartData = Object.entries(monthlyData)
          .slice(-6)
          .map(([month, amount]) => ({ month, amount }));
        setMonthlySpend(chartData);
      }

      // Calculate category spend
      const { data: vendorsData } = await supabase.from('vendors').select('category');
      if (vendorsData) {
        const categoryData = {};
        vendorsData.forEach(vendor => {
          const cat = vendor.category || 'Other';
          categoryData[cat] = (categoryData[cat] || 0) + 1;
        });

        const chartData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));
        setCategorySpend(chartData);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444'];

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: 'warning',
      in_review: 'info',
      approved: 'success',
      completed: 'success',
      in_progress: 'primary',
      rejected: 'danger'
    };
    return statusMap[status] || 'info';
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="dashboard">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1>Welcome back, {user.name}! 👋</h1>
            <p>Here's what's happening with your procurement today</p>
          </div>
          <div className="header-actions">
            <Link to="/rfq/create" className="btn btn-primary">
              <Plus size={18} />
              Create RFQ
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="stats-grid">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={index} className={`stat-card stat-${stat.color}`}>
                    <div className="stat-icon">
                      <Icon size={24} />
                    </div>
                    <div className="stat-content">
                      <p className="stat-label">{stat.label}</p>
                      <h3 className="stat-value">{stat.value}</h3>
                    </div>
                  </div>
                );
              })}
            </div>

        {/* Charts Section */}
        <div className="charts-grid">
          <div className="card chart-card">
            <div className="card-header">
              <h3>Monthly Procurement Spend</h3>
              <span className="chart-subtitle">Last 6 months</span>
            </div>
            <div className="chart-container">
              {monthlySpend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlySpend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#f1f5f9' }}
                    />
                    <Bar dataKey="amount" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">
                  <FileText size={48} />
                  <p>No spending data yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="card chart-card">
            <div className="card-header">
              <h3>Category Distribution</h3>
              <span className="chart-subtitle">Current fiscal year</span>
            </div>
            <div className="chart-container">
              {categorySpend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categorySpend}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categorySpend.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">
                  <FileText size={48} />
                  <p>No category data yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="content-grid">
          {/* Recent RFQs */}
          <div className="card">
            <div className="card-header">
              <h3>Recent RFQs</h3>
              <Link to="/rfq/create" className="view-all">View All <ArrowUpRight size={16} /></Link>
            </div>
            {recentRFQs.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>RFQ ID</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Deadline</th>
                      <th>Vendors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRFQs.map((rfq) => (
                      <tr key={rfq.id}>
                        <td><strong>{rfq.id}</strong></td>
                        <td>{rfq.title}</td>
                        <td>
                          <span className={`badge badge-${getStatusBadge(rfq.status)}`}>
                            {rfq.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>{rfq.deadline}</td>
                        <td>{rfq.vendors} vendors</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <FileText size={48} />
                <h3>No RFQs yet</h3>
                <p>Create your first RFQ to get started</p>
                <Link to="/rfq/create" className="btn btn-primary">
                  <Plus size={18} />
                  Create RFQ
                </Link>
              </div>
            )}
          </div>

          {/* Pending Approvals */}
          {(user.role === 'manager' || user.role === 'admin') && (
            <div className="card">
              <div className="card-header">
                <h3>Pending Approvals</h3>
                <Link to="/approvals" className="view-all">View All <ArrowUpRight size={16} /></Link>
              </div>
              {pendingApprovals.length > 0 ? (
                <div className="approval-list">
                  {pendingApprovals.map((approval) => (
                    <div key={approval.id} className="approval-item">
                      <div className="approval-icon">
                        <AlertCircle size={20} />
                      </div>
                      <div className="approval-info">
                        <h4>{approval.rfq}</h4>
                        <p>Amount: {approval.amount} • By: {approval.submittedBy}</p>
                        <span className="approval-date">{approval.date}</span>
                      </div>
                      <div className="approval-actions">
                        <button className="btn btn-sm btn-secondary">Review</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <CheckCircle size={48} />
                  <h3>No pending approvals</h3>
                  <p>All caught up!</p>
                </div>
              )}
            </div>
          )}

          {/* Recent Purchase Orders */}
          <div className="card">
            <div className="card-header">
              <h3>Recent Purchase Orders</h3>
              <Link to="/purchase-orders" className="view-all">View All <ArrowUpRight size={16} /></Link>
            </div>
            {recentPOs.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Vendor</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPOs.map((po) => (
                      <tr key={po.id}>
                        <td><strong>{po.id}</strong></td>
                        <td>{po.vendor}</td>
                        <td><strong>{po.amount}</strong></td>
                        <td>{po.date}</td>
                        <td>
                          <span className={`badge badge-${getStatusBadge(po.status)}`}>
                            {po.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <ShoppingCart size={48} />
                <h3>No purchase orders yet</h3>
                <p>Purchase orders will appear here once approved</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="quick-actions">
              <Link to="/rfq/create" className="quick-action-btn">
                <FileText size={24} />
                <span>Create RFQ</span>
              </Link>
              <Link to="/vendors" className="quick-action-btn">
                <Users size={24} />
                <span>Manage Vendors</span>
              </Link>
              <Link to="/quotations/compare" className="quick-action-btn">
                <CheckCircle size={24} />
                <span>Compare Quotes</span>
              </Link>
              <Link to="/purchase-orders" className="quick-action-btn">
                <ShoppingCart size={24} />
                <span>View Orders</span>
              </Link>
            </div>
          </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

export default Dashboard;
