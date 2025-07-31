const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function createTables() {
  try {
    console.log('Creating database tables...');
    
    // Test if tables already exist by trying to query them
    const { data: existingPresentations, error: checkError } = await supabase
      .from('presentations')
      .select('count')
      .limit(1);
    
    if (!checkError) {
      console.log('✅ Tables already exist!');
      return;
    }
    
    console.log('Tables do not exist. Please create them manually in Supabase dashboard.');
    console.log('\nSQL to create tables:');
    console.log('\n-- Create presentations table');
    console.log(`CREATE TABLE presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  current_slide_index INTEGER DEFAULT 0,
  present_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);
    
    console.log('\n-- Create slides table');
    console.log(`CREATE TABLE slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID REFERENCES presentations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  slide_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);
    
    console.log('\n-- Create text_blocks table');
    console.log(`CREATE TABLE text_blocks (
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
);`);
    
    console.log('\n-- Create presentation_users table');
    console.log(`CREATE TABLE presentation_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID REFERENCES presentations(id) ON DELETE CASCADE,
  nickname VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  socket_id VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);
    
    console.log('\n-- Create updated_at triggers');
    console.log(`CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_presentations_updated_at BEFORE UPDATE ON presentations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_slides_updated_at BEFORE UPDATE ON slides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_text_blocks_updated_at BEFORE UPDATE ON text_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`);
    
    console.log('\n📋 Please copy and paste the above SQL into your Supabase SQL editor to create the tables.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTables();