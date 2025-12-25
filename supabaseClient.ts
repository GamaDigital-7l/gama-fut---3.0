
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://goxokmuwarpvdpfioula.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdveG9rbXV3YXJwdmRwZmlvdWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1OTQ5NDUsImV4cCI6MjA4MjE3MDk0NX0.mKSHl1bltQo68802S10S75eXda1dsiz8phnKfQddYC0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
