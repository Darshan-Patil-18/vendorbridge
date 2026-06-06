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
      console.log('Fetching approvals...');
      
      // Step 1: Fetch all approvals
      const { data: approvalsData, error: approvalsError } = await supabase
        .from('approvals')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Approvals data:', approvalsData);

      if (approvalsError) {
        console.error('Approvals error:', approvalsError);
        throw approvalsError;
      }

      if (!approvalsData || approvalsData.length === 0) {
        console.log('No approvals found');
        setApprovals([]);
        setLoading(false);
        return;
      }

      // Step 2: Get unique IDs for batch fetching
      const rfqIds = [...new Set(approvalsData.map(a => a.rfq_id).filter(Boolean))];
      const quotationIds = [...new Set(approvalsData.map(a => a.quotation_id).filter(Boolean))];
      const userIds = [...new Set(approvalsData.map(a => a.requested_by).filter(Boolean))];

      console.log('Fetching related data...', { rfqIds, quotationIds, userIds });

      // Step 3: Fetch related data in parallel with error handling
      const [rfqsResult, quotationsResult, profilesResult] = await Promise.all([
        rfqIds.length > 0 
          ? supabase.from('rfqs').select('id, title, priority, created_at').in('id', rfqIds)
          : Promise.resolve({ data: [] }),
        quotationIds.length > 0
          ? supabase.from('quotations').select('id, vendor_name, total_amount, vendor_id').in('id', quotationIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', userIds)
          : Promise.resolve({ data: [] })
      ]);

      console.log('Related data fetched:', {
        rfqs: rfqsResult.data?.length || 0,
        quotations: quotationsResult.data?.length || 0,
        profiles: profilesResult.data?.length || 0
      });

      // Step 4: Create lookup maps
      const rfqsMap = {};
      const quotationsMap = {};
      const profilesMap = {};

      (rfqsResult.data || []).forEach(rfq => {
        rfqsMap[rfq.id] = rfq;
      });

      (quotationsResult.data || []).forEach(q => {
        quotationsMap[q.id] = q;
      });

      (profilesResult.data || []).forEach(p => {
        profilesMap[p.id] = p;
      });

      // Step 5: Map approvals with related data
      const approvalsList = approvalsData.map(approval => {
        const rfq = rfqsMap[approval.rfq_id] || {};
        const quotation = quotationsMap[approval.quotation_id] || {};
        const profile = profilesMap[approval.requested_by] || {};

        const rfqIdShort = rfq.id ? String(rfq.id).substring(0, 8) : 'N/A';
        const approvalId = approval.id ? String(approval.id).substring(0, 8) : 'N/A';

        return {
          id: approvalId,
          fullId: approval.id,
          rfqId: rfqIdShort,
          rfqTitle: rfq.title || 'N/A',
          priority: rfq.priority || 'medium',
          vendor: quotation.vendor_name || 'Unknown Vendor',
          vendorId: quotation.vendor_id || null,
          amount: Number(quotation.total_amount || 0),
          submittedBy: profile.full_name || 'Unknown User',
          submittedDate: formatDate(approval.created_at),
          status: approval.status || 'pending',
          remarks: approval.remarks || '',
          quotationId: approval.quotation_id,
          rfqFullId: approval.rfq_id,
          timeline: [
            { 
              stage: 'RFQ Created', 
              status: 'completed', 
              date: rfq.created_at ? formatDate(rfq.created_at) : null 
            },
            { 
              stage: 'Quotation Selected', 
              status: 'completed', 
              date: formatDate(approval.created_at) 
            },
            { 
              stage: 'Approval Review', 
              status: approval.status === 'pending' ? 'current' : 'completed', 
              date: approval.status !== 'pending' ? formatDate(approval.updated_at || approval.created_at) : null 
            },
            { 
              stage: 'PO Generation', 
              status: approval.status === 'approved' ? 'completed' : 'pending', 
              date: null 
            }
          ]
        };
      });

      console.log('Mapped approvals:', approvalsList);
      setApprovals(approvalsList);
    } catch (error) {
      console.error('Error fetching approvals:', error);
      console.error('Error details:', error.message, error.details, error.hint);
      alert('Error loading approvals: ' + (error.message || 'Unknown error. Check console for details.'));
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
        .eq('id', approval.fullId);

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
            approval_id: approval.fullId,
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
        .eq('id', approval.fullId);

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
              <div key={approval.fullId} className="approval-card card">
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
