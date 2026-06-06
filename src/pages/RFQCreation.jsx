import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Plus, X, Calendar, Send, Save, Trash2, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/utils';
import './RFQCreation.css';

function RFQCreation({ user, onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deadline: '',
    category: '',
    priority: 'medium',
  });

  const [items, setItems] = useState([
    { id: 1, product: '', quantity: '', unit: '', specifications: '' }
  ]);

  const [selectedVendors, setSelectedVendors] = useState([]);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoadingVendors(true);
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, category, status')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoadingVendors(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const addItem = () => {
    setItems([...items, { 
      id: Date.now(), 
      product: '', 
      quantity: '', 
      unit: '', 
      specifications: '' 
    }]);
  };

  const removeItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const toggleVendor = (vendorId) => {
    if (selectedVendors.includes(vendorId)) {
      setSelectedVendors(selectedVendors.filter(id => id !== vendorId));
    } else {
      setSelectedVendors([...selectedVendors, vendorId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedVendors.length === 0) {
      alert('Please select at least one vendor!');
      return;
    }

    setLoading(true);

    try {
      // Get user_ids for selected vendors (if they have linked accounts)
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('id, user_id')
        .in('id', selectedVendors);

      if (vendorError) throw vendorError;

      // Extract user_ids where they exist
      const selectedVendorUserIds = vendorData
        .filter(v => v.user_id)
        .map(v => v.user_id);

      // Insert RFQ
      const { data: rfqData, error: rfqError } = await supabase
        .from('rfqs')
        .insert([
          {
            created_by: user.id,
            title: formData.title,
            category: formData.category,
            priority: formData.priority,
            deadline: formData.deadline,
            description: formData.description,
            status: 'pending',
            selected_vendors: selectedVendors,
            selected_vendor_user_ids: selectedVendorUserIds.length > 0 ? selectedVendorUserIds : null
          }
        ])
        .select()
        .single();

      if (rfqError) throw rfqError;

      // Insert RFQ items
      const itemsToInsert = items.map(item => ({
        rfq_id: rfqData.id,
        product_name: item.product,
        quantity: parseInt(item.quantity),
        unit: item.unit,
        specifications: item.specifications
      }));

      const { error: itemsError } = await supabase
        .from('rfq_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Log activity
      await logActivity(
        user.id,
        user.name,
        'RFQ Created',
        `Created RFQ: ${formData.title} with ${items.length} items for ${selectedVendors.length} vendors`
      );

      alert(`RFQ Created Successfully!\n\nRFQ: ${formData.title}\nVendors Notified: ${selectedVendors.length}`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error creating RFQ:', error);
      alert('Error creating RFQ. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="rfq-creation">
        <div className="page-header">
          <div>
            <h1>Create Request for Quotation (RFQ)</h1>
            <p>Initiate a new procurement request</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rfq-form">
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="title">RFQ Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                className="form-control"
                placeholder="e.g., Office Supplies Q1 2026"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select
                  id="category"
                  name="category"
                  className="form-control"
                  value={formData.category}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Category</option>
                  <option value="IT & Hardware">IT & Hardware</option>
                  <option value="Office Supplies">Office Supplies</option>
                  <option value="Services">Services</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="priority">Priority *</label>
                <select
                  id="priority"
                  name="priority"
                  className="form-control"
                  value={formData.priority}
                  onChange={handleChange}
                  required
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="deadline">
                  <Calendar size={16} />
                  Deadline *
                </label>
                <input
                  type="date"
                  id="deadline"
                  name="deadline"
                  className="form-control"
                  value={formData.deadline}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                name="description"
                className="form-control"
                placeholder="Provide detailed requirements and specifications..."
                value={formData.description}
                onChange={handleChange}
                rows="4"
                required
              />
            </div>
          </div>

          <div className="form-section">
            <div className="section-header">
              <h3>Items & Specifications</h3>
              <button type="button" className="btn btn-secondary" onClick={addItem}>
                <Plus size={18} />
                Add Item
              </button>
            </div>

            <div className="items-list">
              {items.map((item, index) => (
                <div key={item.id} className="item-card">
                  <div className="item-header">
                    <span className="item-number">Item #{index + 1}</span>
                    {items.length > 1 && (
                      <button 
                        type="button" 
                        className="icon-btn danger" 
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Product/Service Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g., Laptop Dell XPS 15"
                        value={item.product}
                        onChange={(e) => handleItemChange(item.id, 'product', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Quantity *</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="0"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Unit *</label>
                      <select
                        className="form-control"
                        value={item.unit}
                        onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                        required
                      >
                        <option value="">Select</option>
                        <option value="pieces">Pieces</option>
                        <option value="boxes">Boxes</option>
                        <option value="units">Units</option>
                        <option value="kg">Kilograms</option>
                        <option value="liters">Liters</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Specifications</label>
                    <textarea
                      className="form-control"
                      placeholder="Additional specifications or requirements..."
                      value={item.specifications}
                      onChange={(e) => handleItemChange(item.id, 'specifications', e.target.value)}
                      rows="2"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3>Select Vendors</h3>
            {loadingVendors ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading vendors...</p>
              </div>
            ) : vendors.length > 0 ? (
              <>
                <div className="vendors-grid">
                  {vendors.map((vendor) => (
                    <div
                      key={vendor.id}
                      className={`vendor-select-card ${selectedVendors.includes(vendor.id) ? 'selected' : ''}`}
                      onClick={() => toggleVendor(vendor.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedVendors.includes(vendor.id)}
                        onChange={() => {}}
                      />
                      <div>
                        <h4>{vendor.name}</h4>
                        <p>{vendor.category}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="helper-text">Selected: {selectedVendors.length} vendor(s)</p>
              </>
            ) : (
              <div className="empty-state">
                <User size={48} />
                <p>No vendors available. Please add vendors first in Vendor Management.</p>
                <Link to="/vendors" className="btn btn-secondary">
                  <Plus size={18} />
                  Add Vendors
                </Link>
              </div>
            )}
          </div>

          <div className="form-actions">
            <Link to="/dashboard" className="btn btn-outline">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : (
                <>
                  <Send size={18} />
                  Send RFQ to Vendors
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

export default RFQCreation;
