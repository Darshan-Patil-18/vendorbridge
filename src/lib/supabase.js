import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eugtvjhhmpmslqfproxf.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Z3R2amhobXBtc2xxZnByb3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MTQ0NjMsImV4cCI6MjA5NjI5MDQ2M30.sgOZtqvcobBm3rlH63HOB_LQzb4-RU-T2W4XQMBEN1g'

export const supabase = createClient(supabaseUrl, supabaseKey)