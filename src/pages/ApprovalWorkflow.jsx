import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { CheckCircle, XCircle, Clock, User, DollarSign, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity, formatDate } from '../lib/utils';
import './SharedPages.css';

function ApprovalWorkflow({ user, onLogout }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      
      // Fetch approvals
      const { data: approvalsData, error: approvalsError } = await supabase
        .from('approvals')
        .select('*')
        .order('created_at', { ascending: false });

      if (approvalsError) throw approvalsError;

      if (!approvalsData || approvalsData.length === 0) {
        setApprovals([]);
        return;
      }

      // Get related data separately to avoid join issues
      const rfqIds = [...new Set(approvalsData.map(a => a.rfq_id).filter(Boolean))];
      const quotationIds = [...new Set(approvalsData.map(a => a.quotation_id).filter(Boolean))];
      const userIds = [...new Set(approvalsData.map(a => a.requested_by).filter(Boolean))];

      // Fetch RFQs
      const { data: rfqsData } = await supabase
        .from('rfqs')
        .select('id, title, priority, created_at')
        .in('id', rfqIds);

      // Fetch Quotations
      const { data: quotationsData } = await supabase
        .from('quotations')
        .select('id, vendor_name, total_amount, vendor_id')
        .in('id', quotationIds);

      // Fetch User profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      // Create lookup maps
      const rfqsMap = (rfqsData || []).reduce((acc, rfq) => {
        acc[rfq.id] = rfq;
        return acc;
      }, {});

      const quotationsMap = (quotationsData || []).reduce((acc, q) => {
        acc[q.id] = q;
        return acc;
      }, {});

      const profilesMap = (profilesData || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      // Map approvals with related data
      const approvalsList = approvalsData.map(approval => {
        const rfq = rfqsMap[approval.rfq_id] || {};
        const quotation = quotationsMap[approval.quotation_id] || {};
        const profile = profilesMap[approval.requested_by] || {};

        return {
          id: approval.id,
          rfqId: rfq.id?.substring(0, 8) || 'N/A',
          rfqTitle: rfq.title || 'N/A',
          priority: rfq.priority || 'medium',
          vendor: quotation.vendor_name || 'Unknown',
          vendorId: quotation.vendor_id,
          amount: Number(quotation.total_amount || 0),
          submittedBy: profile.full_name || 'Unknown',
          submittedDate: formatDate(approval.created_at),
          status: approval.status,
          remarks: approval.remarks,
          quotationId: approval.quotation_id,
          rfqFullId: approval.rfq_id,
          timeline: [
            { stage: 'RFQ Created', status: 'completed', date: formatDate(rfq.created_at) },
            { stage: 'Quotation Selected', status: 'completed', date: formatDate(approval.created_at) },
            { stage: 'Approval Review', status: approval.status === 'pending' ? 'current' : 'completed', date: approval.status !== 'pending' ? formatDate(approval.created_at) : null },
            { stage: 'PO Generation', status: approval.status === 'approved' ? 'completed' : 'pending', date: null }
          ]
        };
      });

      setApprovals(approvalsList);
    } catch (error) {
      console.error('Error fetching approvals:', error);
      alert('Error loading approvals: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approval) => {
    if (!remarks.trim()) {
      alert('Please add approval remarks');
      return;
    }

    try {
      setProcessing(true);

      // Update approval status
      const { error: approvalError } = await supabase
        .from('approvals')
        .update({ 
          status: 'approved', 
          remarks: remarks,
          approved_by: user.id 
        })
        .eq('id', approval.id);

      if (approvalError) throw approvalError;

      // Create purchase order
      const subtotal = approval.amount;
      const tax = subtotal * 0.15;
      const total = subtotal + tax;

      const { error: poError } = await supabase
        .from('purchase_orders')
        .insert([
          {
            rfq_id: approval.rfqFullId,
            quotation_id: approval.quotationId,
            approval_id: approval.id,
            vendor_name: approval.vendor,
            amount: subtotal,
            tax: tax,
            total: total,
            status: 'in_progress',
            invoice_generated: false
          }
        ]);

      if (poError) throw poError;

      // Update RFQ status
      const { error: rfqError } = await supabase
        .from('rfqs')
        .update({ status: 'approved' })
        .eq('id', approval.rfqFullId);

      if (rfqError) throw rfqError;

      // Log activity
      await logActivity(
        user.id,
        user.name,
        'Approval Granted',
        `Approved purchase order for ${approval.vendor} - Amount: $${total.toLocaleString()}`
      );

      alert(`Approval approved!\nPurchase Order has been generated for ${approval.vendor}.`);
      setSelectedApproval(null);
      setRemarks('');
      await fetchApprovals();
    } catch (error) {
      console.error('Error approving:', error);
      alert('Error approving request. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (approval) => {
    if (!remarks.trim()) {
      alert('Please add rejection reason');
      return;
    }

    try {
      setProcessing(true);

      // Update approval status
      const { error: approvalError } = await supabase
        .from('approvals')
        .update({ 
          status: 'rejected', 
          remarks: remarks,
          approved_by: user.id 
        })
        .eq('id', approval.id);

      if (approvalError) throw approvalError;

      // Update RFQ status
      const { error: rfqError } = await supabase
        .from('rfqs')
        .update({ status: 'rejected' })
        .eq('id', approval.rfqFullId);

      if (rfqError) throw rfqError;

      // Log activity
      await logActivity(
        user.id,
        user.name,
        'Approval Rejected',
        `Rejected quotation from ${approval.vendor} - Reason: ${remarks}`
      );

      alert(`Approval rejected.`);
      setSelectedApproval(null);
      setRemarks('');
      await fetchApprovals();
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Error rejecting request. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'info',
      medium: 'warning',
      high: 'danger',
      urgent: 'danger'
    };
    return colors[priority];
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger'
    };
    return colors[status];
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="approval-workflow">
        <div className="page-header">
          <div>
            <h1>Approval Workflow</h1>
            <p>Review and approve procurement requests</p>
          </div>
        </div>

        {!selectedApproval ? (
          <>
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading approvals...</p>
              </div>
            ) : approvals.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={48} />
                <h3>No pending approvals</h3>
                <p>All caught up! Approval requests will appear here.</p>
              </div>
            ) : (
              <div className="approvals-list">
                {approvals.map((approval) => (
              <div key={approval.id} className="approval-card card">
                <div className="approval-card-header">
                  <div>
                    <h3>{approval.rfqTitle}</h3>
                    <p className="approval-id">{approval.id} • {approval.rfqId}</p>
                  </div>
                  <div className="badges">
                    <span className={`badge badge-${getPriorityColor(approval.priority)}`}>
                      {approval.priority}
                    </span>
                    <span className={`badge badge-${getStatusColor(approval.status)}`}>
                      {approval.status}
                    </span>
                  </div>
                </div>

                <div className="approval-details">
                  <div className="detail-item">
                    <User size={16} />
                    <div>
                      <span className="label">Vendor</span>
                      <p>{approval.vendor}</p>
                    </div>
                  </div>

                  <div className="detail-item">
                    <DollarSign size={16} />
                    <div>
                      <span className="label">Amount</span>
                      <p className="amount">${approval.amount.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="detail-item">
                    <User size={16} />
                    <div>
                      <span className="label">Submitted By</span>
                      <p>{approval.submittedBy}</p>
                    </div>
                  </div>

                  <div className="detail-item">
                    <Clock size={16} />
                    <div>
                      <span className="label">Date</span>
                      <p>{approval.submittedDate}</p>
                    </div>
                  </div>
                </div>

                <div className="approval-timeline">
                  {approval.timeline.map((stage, idx) => (
                    <div key={idx} className={`timeline-stage ${stage.status}`}>
                      <div className="timeline-dot"></div>
                      <div className="timeline-content">
                        <p className="stage-name">{stage.stage}</p>
                        {stage.date && <span className="stage-date">{stage.date}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {approval.status === 'pending' && (
                  <div className="approval-actions">
                    <button
                      className="btn btn-outline"
                      onClick={() => setSelectedApproval(approval)}
                    >
                      Review Details
                    </button>
                  </div>
                )}
              </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="approval-details-view">
            <button className="btn btn-outline" onClick={() => setSelectedApproval(null)}>
              ← Back to List
            </button>

            <div className="card approval-review">
              <h2>Review Approval Request</h2>
              
              <div className="review-section">
                <h3>Request Details</h3>
                <div className="review-grid">
                  <div>
                    <span className="label">Approval ID</span>
                    <p>{selectedApproval.id}</p>
                  </div>
                  <div>
                    <span className="label">RFQ</span>
                    <p>{selectedApproval.rfqId} - {selectedApproval.rfqTitle}</p>
                  </div>
                  <div>
                    <span className="label">Selected Vendor</span>
                    <p>{selectedApproval.vendor}</p>
                  </div>
                  <div>
                    <span className="label">Total Amount</span>
                    <p className="amount">${selectedApproval.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="label">Submitted By</span>
                    <p>{selectedApproval.submittedBy}</p>
                  </div>
                  <div>
                    <span className="label">Submission Date</span>
                    <p>{selectedApproval.submittedDate}</p>
                  </div>
                </div>
              </div>

              <div className="review-section">
                <h3>Approval Status</h3>
                <div className="approval-timeline horizontal">
                  {selectedApproval.timeline.map((stage, idx) => (
                    <div key={idx} className={`timeline-stage ${stage.status}`}>
                      <div className="timeline-dot">
                        {stage.status === 'completed' && <CheckCircle size={16} />}
                        {stage.status === 'current' && <Clock size={16} />}
                      </div>
                      <div className="timeline-content">
                        <p className="stage-name">{stage.stage}</p>
                        {stage.date && <span className="stage-date">{stage.date}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="review-section">
                <h3>Add Remarks</h3>
                <textarea
                  className="form-control"
                  placeholder="Enter your remarks, comments, or reasons..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows="4"
                  required
                />
              </div>

              <div className="review-actions">
                <button
                  className="btn btn-danger"
                  onClick={() => handleReject(selectedApproval)}
                  disabled={processing}
                >
                  <XCircle size={18} />
                  {processing ? 'Rejecting...' : 'Reject Request'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleApprove(selectedApproval)}
                  disabled={processing}
                >
                  <CheckCircle size={18} />
                  {processing ? 'Approving...' : 'Approve Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ApprovalWorkflow;
