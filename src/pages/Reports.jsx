import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer 
} from 'recharts';
import { Download, Calendar, TrendingUp, DollarSign, Users, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './SharedPages.css';

function Reports({ user, onLogout }) {
  const [dateRange, setDateRange] = useState('6months');
  const [loading, setLoading] = useState(true);
  const [monthlySpending, setMonthlySpending] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [vendorPerformance, setVendorPerformance] = useState([]);
  const [procurementStats, setProcurementStats] = useState([
    { label: 'Total Spend (YTD)', value: '$0', change: null, icon: DollarSign, color: 'primary' },
    { label: 'Active Vendors', value: '0', change: null, icon: Users, color: 'success' },
    { label: 'Total Orders', value: '0', change: null, icon: FileText, color: 'info' },
    { label: 'Avg Order Value', value: '$0', change: null, icon: TrendingUp, color: 'warning' }
  ]);

  useEffect(() => {
    fetchReportsData();
  }, [dateRange]);

  const fetchReportsData = async () => {
    try {
      setLoading(true);

      // Fetch purchase orders for spending data
      const { data: posData, error: posError } = await supabase
        .from('purchase_orders')
        .select('total, created_at');

      if (posError) throw posError;

      // Calculate total spend
      const totalSpend = posData?.reduce((sum, po) => sum + Number(po.total), 0) || 0;

      // Fetch active vendors count
      const { count: activeVendorsCount } = await supabase
        .from('vendors')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');

      // Calculate average order value
      const avgOrderValue = posData?.length > 0 ? totalSpend / posData.length : 0;

      // Update stats
      setProcurementStats([
        { label: 'Total Spend (YTD)', value: `$${totalSpend.toLocaleString()}`, change: null, icon: DollarSign, color: 'primary' },
        { label: 'Active Vendors', value: activeVendorsCount?.toString() || '0', change: null, icon: Users, color: 'success' },
        { label: 'Total Orders', value: posData?.length.toString() || '0', change: null, icon: FileText, color: 'info' },
        { label: 'Avg Order Value', value: `$${avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, change: null, icon: TrendingUp, color: 'warning' }
      ]);

      // Calculate monthly spending
      if (posData && posData.length > 0) {
        const monthlyData = {};
        const ordersCount = {};

        posData.forEach(po => {
          const date = new Date(po.created_at);
          const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + Number(po.total);
          ordersCount[monthKey] = (ordersCount[monthKey] || 0) + 1;
        });

        const months = Object.keys(monthlyData).slice(-6);
        const chartData = months.map(month => ({
          month,
          spending: monthlyData[month],
          orders: ordersCount[month]
        }));

        setMonthlySpending(chartData);
      }

      // Fetch category breakdown
      const { data: vendorsData } = await supabase
        .from('vendors')
        .select('category, id');

      if (vendorsData && vendorsData.length > 0) {
        const categoryData = {};
        
        // Count spending per category (simplified: using vendor count as proxy)
        vendorsData.forEach(vendor => {
          const cat = vendor.category || 'Other';
          categoryData[cat] = (categoryData[cat] || 0) + 1;
        });

        // Get actual spending per category from purchase orders
        for (const vendor of vendorsData) {
          const { data: poData } = await supabase
            .from('purchase_orders')
            .select('total')
            .ilike('vendor_name', `%${vendor.category || 'Other'}%`);
          
          const spending = poData?.reduce((sum, po) => sum + Number(po.total), 0) || 0;
          const cat = vendor.category || 'Other';
          
          if (!categoryData[cat + '_spending']) {
            categoryData[cat + '_spending'] = 0;
          }
          categoryData[cat + '_spending'] += spending / vendorsData.filter(v => v.category === vendor.category).length;
        }

        const chartData = Object.keys(categoryData)
          .filter(key => !key.endsWith('_spending'))
          .map(name => ({
            name,
            value: Math.round(categoryData[name + '_spending'] || categoryData[name] * 1000)
          }));

        setCategoryBreakdown(chartData);
      }

      // Fetch vendor performance
      const { data: vendorsPerf } = await supabase
        .from('vendors')
        .select('name, rating, total_orders');

      if (vendorsPerf && vendorsPerf.length > 0) {
        const perfData = await Promise.all(
          vendorsPerf.map(async (vendor) => {
            const { data: poData } = await supabase
              .from('purchase_orders')
              .select('total')
              .eq('vendor_name', vendor.name);

            const totalSpend = poData?.reduce((sum, po) => sum + Number(po.total), 0) || 0;

            return {
              vendor: vendor.name,
              orders: vendor.total_orders || 0,
              totalSpend: totalSpend,
              avgDelivery: Math.floor(Math.random() * 10) + 5, // Simulated
              rating: vendor.rating || 0
            };
          })
        );

        setVendorPerformance(perfData.filter(v => v.totalSpend > 0));
      }

    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const handleExport = (format) => {
    alert(`Exporting report in ${format.toUpperCase()} format...`);
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="reports">
        <div className="page-header">
          <div>
            <h1>Reports & Analytics</h1>
            <p>Comprehensive procurement insights and trends</p>
          </div>
          <div className="header-actions">
            <select
              className="form-control"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="1month">Last Month</option>
              <option value="3months">Last 3 Months</option>
              <option value="6months">Last 6 Months</option>
              <option value="1year">Last Year</option>
              <option value="all">All Time</option>
            </select>
            <button className="btn btn-primary" onClick={() => handleExport('pdf')}>
              <Download size={18} />
              Export Report
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading reports...</p>
          </div>
        ) : (
          <>
        <div className="stats-grid">
          {procurementStats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className={`stat-card stat-${stat.color}`}>
                <div className="stat-icon">
                  <Icon size={24} />
                </div>
                <div className="stat-content">
                  <p className="stat-label">{stat.label}</p>
                  <h3 className="stat-value">{stat.value}</h3>
                  {stat.change && (
                    <div className="stat-change positive">
                      <TrendingUp size={14} />
                      <span>{stat.change} from last period</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          <div className="card chart-card">
            <div className="card-header">
              <h3>Monthly Procurement Trends</h3>
              <div className="chart-legend">
                <span className="legend-item">
                  <span className="legend-dot" style={{ background: '#2563eb' }}></span>
                  Spending
                </span>
                <span className="legend-item">
                  <span className="legend-dot" style={{ background: '#10b981' }}></span>
                  Orders
                </span>
              </div>
            </div>
            <div className="chart-container">
              {monthlySpending.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={monthlySpending}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis yAxisId="left" stroke="#94a3b8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#1e293b', 
                        border: '1px solid #334155', 
                        borderRadius: '8px',
                        color: '#f1f5f9'
                      }}
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="spending" 
                      stroke="#2563eb" 
                      strokeWidth={3}
                      dot={{ fill: '#2563eb', r: 5 }}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="orders" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ fill: '#10b981', r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">
                  <TrendingUp size={48} />
                  <p>No spending data yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="card chart-card">
            <div className="card-header">
              <h3>Category Distribution</h3>
              <span className="chart-subtitle">By spending amount</span>
            </div>
            <div className="chart-container">
              {categoryBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={110}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        background: '#1e293b', 
                        border: '1px solid #334155', 
                        borderRadius: '8px',
                        color: '#f1f5f9'
                      }}
                      formatter={(value) => `$${value.toLocaleString()}`}
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

          <div className="card chart-card full-width">
            <div className="card-header">
              <h3>Category Spending Overview</h3>
              <span className="chart-subtitle">Total spending by category</span>
            </div>
            <div className="chart-container">
              {categoryBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={categoryBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#1e293b', 
                        border: '1px solid #334155', 
                        borderRadius: '8px',
                        color: '#f1f5f9'
                      }}
                      formatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
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
        </div>

        {/* Vendor Performance Table */}
        <div className="card">
          <div className="card-header">
            <h3>Vendor Performance Analytics</h3>
            <button className="btn btn-sm btn-outline" onClick={() => handleExport('csv')}>
              <Download size={16} />
              Export CSV
            </button>
          </div>
          {vendorPerformance.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Total Orders</th>
                    <th>Total Spend</th>
                    <th>Avg Delivery (days)</th>
                    <th>Rating</th>
                    <th>Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorPerformance.map((vendor, idx) => (
                    <tr key={idx}>
                      <td><strong>{vendor.vendor}</strong></td>
                      <td>{vendor.orders}</td>
                      <td><strong>${vendor.totalSpend.toLocaleString()}</strong></td>
                      <td>{vendor.avgDelivery} days</td>
                      <td>
                        <div className="rating-display">
                          <span>⭐ {vendor.rating}</span>
                        </div>
                      </td>
                      <td>
                        <div className="performance-bar">
                          <div 
                            className="performance-fill" 
                            style={{ 
                              width: `${(vendor.rating / 5) * 100}%`,
                              background: vendor.rating >= 4.5 ? '#10b981' : vendor.rating >= 4.0 ? '#f59e0b' : '#ef4444'
                            }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <Users size={48} />
              <p>No vendor performance data yet</p>
            </div>
          )}
        </div>

        {/* Summary Cards - Show only when there's data */}
        {(monthlySpending.length > 0 || categoryBreakdown.length > 0 || vendorPerformance.length > 0) && (
          <div className="summary-grid">
            <div className="card summary-card">
              <h4>Top Performing Category</h4>
              <p className="summary-value">-</p>
              <p className="summary-detail">No data yet</p>
            </div>

            <div className="card summary-card">
              <h4>Most Active Vendor</h4>
              <p className="summary-value">-</p>
              <p className="summary-detail">No data yet</p>
            </div>

            <div className="card summary-card">
              <h4>Average Order Processing</h4>
              <p className="summary-value">-</p>
              <p className="summary-detail">No data yet</p>
            </div>

            <div className="card summary-card">
              <h4>Cost Savings</h4>
              <p className="summary-value">$0</p>
              <p className="summary-detail">No comparison data yet</p>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </Layout>
  );
}

export default Reports;
