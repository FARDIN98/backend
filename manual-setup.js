const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function manualSetup() {
  console.log('Manual database setup...');
  console.log('\n=== IMPORTANT INSTRUCTIONS ===');
  console.log('Since automatic table creation is not working, please follow these steps:');
  console.log('\n1. Open your Supabase dashboard at: https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to the "SQL Editor" tab');
  console.log('4. Create a new query');
  console.log('5. Copy and paste the following SQL:');
  console.log('\n--- START OF SQL ---');
  
  const sql = `-- CollabSlides Database Schema

-- Create presentations table
CREATE TABLE presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  current_slide_index INTEGER DEFAULT 0,
  present_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create slides table
CREATE TABLE slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID REFERENCES presentations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  slide_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create text_blocks table
CREATE TABLE text_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id UUID REFERENCES slides(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  x FLOAT NOT NULL,
  y FLOAT NOT NULL,
  width FLOAT NOT NULL,
  height FLOAT NOT NULL,
  font_size INTEGER DEFAULT 16,
  font_weight VARCHAR(20) DEFAULT 'normal',
  color VARCHAR(7) DEFAULT '#000000',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create presentation_users table
CREATE TABLE presentation_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID REFERENCES presentations(id) ON DELETE CASCADE,
  nickname VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  socket_id VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_presentations_updated_at BEFORE UPDATE ON presentations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_slides_updated_at BEFORE UPDATE ON slides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_text_blocks_updated_at BEFORE UPDATE ON text_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentation_users ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Enable all operations for presentations" ON presentations FOR ALL USING (true);
CREATE POLICY "Enable all operations for slides" ON slides FOR ALL USING (true);
CREATE POLICY "Enable all operations for text_blocks" ON text_blocks FOR ALL USING (true);
CREATE POLICY "Enable all operations for presentation_users" ON presentation_users FOR ALL USING (true);`;
  
  console.log(sql);
  console.log('\n--- END OF SQL ---');
  console.log('\n6. Click "Run" to execute the SQL');
  console.log('7. After successful execution, run the backend server again');
  console.log('\nOnce you have created the tables, the backend should work properly!');
  
  // Test connection
  console.log('\n=== Testing Supabase Connection ===');
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.log('⚠️  Auth test failed, but this is expected for anonymous access');
    }
    console.log('✅ Supabase client initialized successfully');
    console.log('📡 Supabase URL:', process.env.SUPABASE_URL);
    console.log('🔑 Using API Key:', process.env.SUPABASE_ANON_KEY ? 'Yes' : 'No');
  } catch (err) {
    console.error('❌ Supabase connection test failed:', err.message);
  }
}

manualSetup();