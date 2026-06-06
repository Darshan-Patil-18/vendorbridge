import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { TrendingDown, Star, Clock, CheckCircle, Award, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity, formatDate } from '../lib/utils';
import './SharedPages.css';

function QuotationComparison({ user, onLogout }) {
  const [selectedRFQ, setSelectedRFQ] = useState('');
  const [rfqs, setRfqs] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingQuotations, setLoadingQuotations] = useState(false);

  useEffect(() => {
    fetchRFQs();
  }, []);

  useEffect(() => {
    if (selectedRFQ) {
      fetchQuotations(selectedRFQ);
    }
  }, [selectedRFQ]);

  const fetchRFQs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rfqs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const rfqsList = data.map(rfq => ({
        id: rfq.id,
        title: rfq.title,
        deadline: rfq.deadline,
        status: rfq.status
      }));

      setRfqs(rfqsList);
      
      // Auto-select first RFQ
      if (rfqsList.length > 0) {
        setSelectedRFQ(rfqsList[0].id);
      }
    } catch (error) {
      console.error('Error fetching RFQs:', error);
      alert('Error loading RFQs');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotations = async (rfqId) => {
    try {
      setLoadingQuotations(true);
      
      // Fetch quotations with items
      const { data: quotationsData, error: quotationsError } = await supabase
        .from('quotations')
        .select('*, quotation_items(*)')
        .eq('rfq_id', rfqId);

      if (quotationsError) throw quotationsError;

      // Fetch vendor data for ratings
      const vendorIds = quotationsData.map(q => q.vendor_id);
      const { data: vendorsData } = await supabase
        .from('vendors')
        .select('id, rating')
        .in('id', vendorIds);

      const vendorRatings = {};
      vendorsData?.forEach(v => {
        vendorRatings[v.id] = v.rating || 0;
      });

      const quotationsList = quotationsData.map(q => ({
        id: q.id,
        vendor: q.vendor_name,
        vendorId: q.vendor_id,
        rating: vendorRatings[q.vendor_id] || 0,
        totalAmount: Number(q.total_amount),
        delivery: q.delivery_timeline,
        notes: q.notes,
        items: q.quotation_items.map(item => ({
          product: item.product_name,
          unitPrice: Number(item.unit_price),
          quantity: item.quantity,
          unit: item.unit,
          total: Number(item.total)
        }))
      }));

      setQuotations(quotationsList);
    } catch (error) {
      console.error('Error fetching quotations:', error);
      alert('Error loading quotations');
    } finally {
      setLoadingQuotations(false);
    }
  };

  const currentQuotations = quotations;
  const lowestPrice = currentQuotations.length > 0 ? Math.min(...currentQuotations.map(q => q.totalAmount)) : 0;
  const fastestDelivery = currentQuotations.length > 0 ? currentQuotations.reduce((prev, curr) => {
    const prevDays = parseInt(prev.delivery);
    const currDays = parseInt(curr.delivery);
    return currDays < prevDays ? curr : prev;
  }) : null;

  const handleSelectWinner = async (quotation) => {
    if (!confirm(`Select ${quotation.vendor} as the winning vendor?`)) {
      return;
    }

    try {
      // Update RFQ status to in_review
      const { error: rfqError } = await supabase
        .from('rfqs')
        .update({ status: 'in_review' })
        .eq('id', selectedRFQ);

      if (rfqError) throw rfqError;

      // Create approval request
      const { error: approvalError } = await supabase
        .from('approvals')
        .insert([
          {
            rfq_id: selectedRFQ,
            quotation_id: quotation.id,
            requested_by: user.id,
            status: 'pending'
          }
        ]);

      if (approvalError) throw approvalError;

      // Log activity
      await logActivity(
        user.id,
        user.name,
        'Quotation Selected',
        `Selected quotation from ${quotation.vendor} - Amount: $${quotation.totalAmount.toLocaleString()}`
      );

      alert(`${quotation.vendor} has been selected! Proceeding to approval workflow.`);
      await fetchRFQs();
      await fetchQuotations(selectedRFQ);
    } catch (error) {
      console.error('Error selecting winner:', error);
      alert('Error selecting winner. Please try again.');
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="quotation-comparison">
        <div className="page-header">
          <div>
            <h1>Compare Quotations</h1>
            <p>Analyze and select the best vendor quote</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading RFQs...</p>
          </div>
        ) : rfqs.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <h3>No quotations to compare yet</h3>
            <p>RFQs and quotations will appear here once vendors submit their quotes</p>
          </div>
        ) : (
          <>
            <div className="rfq-selector">
              <label>Select RFQ:</label>
              <select
                className="form-control"
                value={selectedRFQ}
                onChange={(e) => setSelectedRFQ(e.target.value)}
              >
                {rfqs.map(rfq => (
                  <option key={rfq.id} value={rfq.id}>{rfq.id} - {rfq.title}</option>
                ))}
              </select>
            </div>

            {loadingQuotations ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading quotations...</p>
              </div>
            ) : currentQuotations.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} />
                <h3>No quotations received</h3>
                <p>Vendors haven't submitted quotations yet</p>
              </div>
            ) : (
              <>
                <div className="comparison-stats">
                  <div className="stat-card">
                    <TrendingDown size={24} />
                    <div>
                      <p>Lowest Price</p>
                      <h3>${lowestPrice.toLocaleString()}</h3>
                    </div>
                  </div>
                  <div className="stat-card">
                    <Clock size={24} />
                    <div>
                      <p>Fastest Delivery</p>
                      <h3>{fastestDelivery?.delivery}</h3>
                    </div>
                  </div>
                  <div className="stat-card">
                    <Star size={24} />
                    <div>
                      <p>Quotes Received</p>
                      <h3>{currentQuotations.length}</h3>
                    </div>
                  </div>
                </div>

                <div className="comparison-grid">
                  {currentQuotations.map((quote, idx) => (
                    <div key={idx} className={`comparison-card ${quote.totalAmount === lowestPrice ? 'best-price' : ''}`}>
                      {quote.totalAmount === lowestPrice && (
                        <div className="best-badge">
                          <Award size={16} />
                          Best Price
                        </div>
                      )}

                      <div className="vendor-header">
                        <h3>{quote.vendor}</h3>
                        <div className="rating-stars">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={14}
                              fill={star <= quote.rating ? '#f59e0b' : 'none'}
                              stroke={star <= quote.rating ? '#f59e0b' : '#94a3b8'}
                            />
                          ))}
                          <span>{quote.rating}</span>
                        </div>
                      </div>

                      <div className="quote-summary">
                        <div className="summary-item">
                          <span>Total Amount</span>
                          <h2>${quote.totalAmount.toLocaleString()}</h2>
                        </div>
                        <div className="summary-item">
                          <span>Delivery Time</span>
                          <p>{quote.delivery}</p>
                        </div>
                      </div>

                      <div className="items-breakdown">
                        <h4>Item Breakdown</h4>
                        <table>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Unit Price</th>
                              <th>Qty</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quote.items.map((item, itemIdx) => (
                              <tr key={itemIdx}>
                                <td>{item.product}</td>
                                <td>${item.unitPrice}</td>
                                <td>{item.quantity}</td>
                                <td><strong>${item.total}</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        className="btn btn-primary btn-block"
                        onClick={() => handleSelectWinner(quote)}
                      >
                        <CheckCircle size={18} />
                        Select This Quote
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

export default QuotationComparison;
