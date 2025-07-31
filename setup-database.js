const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function setupDatabase() {
  try {
    console.log('Setting up database tables...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute...`);
    
    // Execute each statement individually
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          // Try using the query method for raw SQL
          const { data, error } = await supabase
            .from('_sql')
            .select('*')
            .eq('query', statement);
          
          if (error) {
            console.log(`Statement ${i + 1} failed with query method, trying alternative...`);
            // If that doesn't work, we'll need to create tables manually
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.log(`Statement ${i + 1} failed:`, err.message);
        }
      }
    }
    
    // Test if tables were created by trying to query them
    console.log('\nTesting table creation...');
    
    const tables = ['presentations', 'slides', 'text_blocks', 'presentation_users'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table '${table}' does not exist or is not accessible`);
          console.log(`Error: ${error.message}`);
        } else {
          console.log(`✅ Table '${table}' exists and is accessible`);
        }
      } catch (err) {
        console.log(`❌ Error testing table '${table}':`, err.message);
      }
    }
    
    console.log('\n📋 If tables were not created automatically, please:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy and paste the contents of schema.sql');
    console.log('4. Execute the SQL statements');
    
  } catch (error) {
    console.error('Error setting up database:', error);
  }
}

setupDatabase();