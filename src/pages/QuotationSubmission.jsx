import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Send, Calendar, DollarSign, FileText, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity, formatDate } from '../lib/utils';
import './SharedPages.css';

function QuotationSubmission({ user, onLogout }) {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRFQ, setSelectedRFQ] = useState(null);
  const [quotation, setQuotation] = useState({
    unitPrices: {},
    deliveryTime: '',
    notes: '',
    validityPeriod: '30'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAvailableRFQs();
  }, []);

  const fetchAvailableRFQs = async () => {
    try {
      setLoading(true);
      
      // Fetch ALL RFQs with status 'pending' or 'in_review'
      // This allows any registered vendor to see and quote on all available RFQs
      const { data: rfqsData, error: rfqsError } = await supabase
        .from('rfqs')
        .select('*, rfq_items(*)')
        .in('status', ['pending', 'in_review'])
        .order('created_at', { ascending: false });

      if (rfqsError) throw rfqsError;

      // Check which RFQs already have quotations from this vendor
      const { data: quotationsData, error: quotationsError } = await supabase
        .from('quotations')
        .select('rfq_id')
        .eq('vendor_id', user.id);

      if (quotationsError) throw quotationsError;

      const quotedRfqIds = quotationsData.map(q => q.rfq_id);

      const rfqsList = rfqsData.map(rfq => ({
        ...rfq,
        id: rfq.id,
        title: rfq.title,
        deadline: rfq.deadline,
        items: rfq.rfq_items || [],
        hasQuoted: quotedRfqIds.includes(rfq.id)
      }));

      setRfqs(rfqsList);
    } catch (error) {
      console.error('Error fetching RFQs:', error);
      alert('Error loading RFQs');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRFQ = (rfq) => {
    setSelectedRFQ(rfq);
    const initialPrices = {};
    rfq.items.forEach((item, idx) => {
      initialPrices[idx] = '';
    });
    setQuotation({ 
      unitPrices: initialPrices,
      deliveryTime: '',
      notes: '',
      validityPeriod: '30'
    });
  };

  const handlePriceChange = (idx, value) => {
    setQuotation({
      ...quotation,
      unitPrices: { ...quotation.unitPrices, [idx]: value }
    });
  };

  const calculateTotal = () => {
    if (!selectedRFQ) return 0;
    let total = 0;
    selectedRFQ.items.forEach((item, idx) => {
      const price = parseFloat(quotation.unitPrices[idx]) || 0;
      total += price * item.quantity;
    });
    return total.toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const totalAmount = calculateTotal();

      // Insert quotation
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .insert([
          {
            rfq_id: selectedRFQ.id,
            vendor_id: user.id,
            vendor_name: user.name,
            total_amount: totalAmount,
            delivery_timeline: quotation.deliveryTime,
            validity_period: parseInt(quotation.validityPeriod),
            notes: quotation.notes,
            status: 'submitted'
          }
        ])
        .select()
        .single();

      if (quotationError) throw quotationError;

      // Insert quotation items
      const itemsToInsert = selectedRFQ.items.map((item, idx) => ({
        quotation_id: quotationData.id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: parseFloat(quotation.unitPrices[idx]),
        total: parseFloat(quotation.unitPrices[idx]) * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('quotation_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Log activity
      await logActivity(
        user.id,
        user.name,
        'Quotation Submitted',
        `Submitted quotation for RFQ: ${selectedRFQ.title} - Total: $${totalAmount}`
      );

      alert(`Quotation submitted successfully for ${selectedRFQ.title}!`);
      await fetchAvailableRFQs();
      setSelectedRFQ(null);
    } catch (error) {
      console.error('Error submitting quotation:', error);
      alert('Error submitting quotation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="quotation-submission">
        <div className="page-header">
          <div>
            <h1>Submit Quotation</h1>
            <p>Respond to RFQs with your pricing</p>
          </div>
        </div>

        {!selectedRFQ ? (
          <div className="rfq-list">
            <h3>Available RFQs</h3>
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading RFQs...</p>
              </div>
            ) : rfqs.length > 0 ? (
              <div className="cards-grid">
                {rfqs.map((rfq) => (
                  <div key={rfq.id} className="card rfq-card">
                    <div className="rfq-header">
                      <span className="rfq-id">{rfq.id.substring(0, 8)}</span>
                      {rfq.hasQuoted && (
                        <span className="badge badge-success">Quoted</span>
                      )}
                    </div>
                    <h3>{rfq.title}</h3>
                    <div className="rfq-meta">
                      <div className="meta-item">
                        <Calendar size={16} />
                        <span>Due: {formatDate(rfq.deadline)}</span>
                      </div>
                      <div className="meta-item">
                        <Package size={16} />
                        <span>{rfq.items.length} items</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-block"
                      onClick={() => handleSelectRFQ(rfq)}
                      disabled={rfq.hasQuoted}
                    >
                      {rfq.hasQuoted ? 'Already Quoted' : 'Submit Quote'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <FileText size={48} />
                <h3>No quotations available yet</h3>
                <p>RFQs from procurement officers will appear here</p>
              </div>
            )}
          </div>
        ) : (
          <div className="quotation-form-container">
            <div className="form-header">
              <button className="btn btn-outline" onClick={() => setSelectedRFQ(null)}>
                ← Back to RFQs
              </button>
              <h2>Submit Quote for {selectedRFQ.id}</h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="card">
                <h3>RFQ Details</h3>
                <p className="subtitle">{selectedRFQ.title}</p>
                <div className="detail-row">
                  <span>Deadline:</span>
                  <strong>{formatDate(selectedRFQ.deadline)}</strong>
                </div>
              </div>

              <div className="card">
                <h3>Item Pricing</h3>
                <div className="pricing-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Product/Service</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Unit Price ($)</th>
                        <th>Total ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRFQ.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.product_name}</td>
                          <td>{item.quantity}</td>
                          <td>{item.unit}</td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="form-control"
                              placeholder="0.00"
                              value={quotation.unitPrices[idx]}
                              onChange={(e) => handlePriceChange(idx, e.target.value)}
                              required
                            />
                          </td>
                          <td>
                            <strong>
                              ${((quotation.unitPrices[idx] || 0) * item.quantity).toFixed(2)}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'right' }}><strong>Total Amount:</strong></td>
                        <td><strong className="total-price">${calculateTotal()}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="deliveryTime">
                    <Calendar size={16} />
                    Delivery Timeline *
                  </label>
                  <input
                    type="text"
                    id="deliveryTime"
                    className="form-control"
                    placeholder="e.g., 7-10 business days"
                    value={quotation.deliveryTime}
                    onChange={(e) => setQuotation({ ...quotation, deliveryTime: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="validityPeriod">Quotation Validity (Days)</label>
                  <input
                    type="number"
                    id="validityPeriod"
                    className="form-control"
                    value={quotation.validityPeriod}
                    onChange={(e) => setQuotation({ ...quotation, validityPeriod: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notes / Comments</label>
                <textarea
                  id="notes"
                  className="form-control"
                  placeholder="Add any additional notes, terms, or conditions..."
                  value={quotation.notes}
                  onChange={(e) => setQuotation({ ...quotation, notes: e.target.value })}
                  rows="4"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setSelectedRFQ(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : (
                    <>
                      <Send size={18} />
                      Submit Quotation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default QuotationSubmission;
