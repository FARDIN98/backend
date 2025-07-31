-- CollabSlides Database Schema
-- This file contains the SQL commands to create all necessary tables for the collaborative presentation software

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Presentations table
CREATE TABLE IF NOT EXISTS presentations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    current_slide_index INTEGER DEFAULT 0,
    present_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Slides table
CREATE TABLE IF NOT EXISTS slides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'Untitled Slide',
    slide_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Text blocks table
CREATE TABLE IF NOT EXISTS text_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
    content TEXT DEFAULT '',
    x FLOAT DEFAULT 0,
    y FLOAT DEFAULT 0,
    width FLOAT DEFAULT 200,
    height FLOAT DEFAULT 100,
    font_size INTEGER DEFAULT 16,
    font_weight VARCHAR(20) DEFAULT 'normal',
    color VARCHAR(20) DEFAULT '#000000',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (for active session tracking)
CREATE TABLE IF NOT EXISTS presentation_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
    nickname VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
    socket_id VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_slides_presentation_id ON slides(presentation_id);
CREATE INDEX IF NOT EXISTS idx_slides_order ON slides(presentation_id, slide_order);
CREATE INDEX IF NOT EXISTS idx_text_blocks_slide_id ON text_blocks(slide_id);
CREATE INDEX IF NOT EXISTS idx_presentation_users_presentation_id ON presentation_users(presentation_id);
CREATE INDEX IF NOT EXISTS idx_presentation_users_socket_id ON presentation_users(socket_id);
CREATE INDEX IF NOT EXISTS idx_presentations_updated_at ON presentations(updated_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at columns
CREATE TRIGGER update_presentations_updated_at BEFORE UPDATE ON presentations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slides_updated_at BEFORE UPDATE ON slides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_text_blocks_updated_at BEFORE UPDATE ON text_blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_presentation_users_updated_at BEFORE UPDATE ON presentation_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing
INSERT INTO presentations (id, title) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'Welcome to CollabSlides'),
    ('550e8400-e29b-41d4-a716-446655440001', 'Sample Presentation')
ON CONFLICT (id) DO NOTHING;

INSERT INTO slides (id, presentation_id, title, slide_order) VALUES 
    ('660e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'Welcome Slide', 0),
    ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Features Overview', 1),
    ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Getting Started', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO text_blocks (id, slide_id, content, x, y, width, height, font_size) VALUES 
    ('770e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', '# Welcome to CollabSlides\n\nReal-time collaborative presentations made easy!', 100, 100, 400, 200, 18),
    ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '## Key Features\n\n- Real-time collaboration\n- Role-based permissions\n- Markdown support\n- Present mode', 150, 150, 350, 250, 16),
    ('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', '## Getting Started\n\n1. Enter your nickname\n2. Create or join a presentation\n3. Start collaborating!', 120, 120, 380, 180, 16)
ON CONFLICT (id) DO NOTHING;