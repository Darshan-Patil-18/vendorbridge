import { supabase } from './supabase';

/**
 * Log an activity to the activity_logs table
 */
export const logActivity = async (userId, userName, action, description) => {
  try {
    const { error } = await supabase.from('activity_logs').insert([
      {
        user_id: userId,
        user_name: userName,
        action: action,
        description: description,
      }
    ]);

    if (error) throw error;
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

/**
 * Format date for display
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

/**
 * Format currency
 */
export const formatCurrency = (amount) => {
  if (!amount) return '$0';
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
