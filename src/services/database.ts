import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Types
export interface TextBlock {
  id: string;
  slide_id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: number;
  font_weight: string;
  color: string;
  created_at?: string;
  updated_at?: string;
}

export interface Slide {
  id: string;
  presentation_id: string;
  title: string;
  slide_order: number;
  text_blocks?: TextBlock[];
  created_at?: string;
  updated_at?: string;
}

export interface PresentationUser {
  id: string;
  presentation_id: string;
  nickname: string;
  role: 'owner' | 'editor' | 'viewer';
  socket_id?: string;
  is_active: boolean;
  joined_at?: string;
  last_seen?: string;
}

export interface Presentation {
  id: string;
  title: string;
  current_slide_index: number;
  present_mode: boolean;
  slides?: Slide[];
  users?: PresentationUser[];
  created_at?: string;
  updated_at?: string;
}

class DatabaseService {
  private supabase: SupabaseClient;
  private isConnected: boolean = false;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.isConnected = true;
  }

  // Test database connection
  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('presentations')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('Database connection test failed:', error);
        return false;
      }
      
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  // Presentation operations
  async getAllPresentations(): Promise<Presentation[]> {
    const { data, error } = await this.supabase
      .from('presentations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch presentations: ${error.message}`);
    }

    return data || [];
  }

  async createPresentation(title: string): Promise<Presentation> {
    const presentationId = uuidv4();
    const slideId = uuidv4();
    
    // Create presentation
    const { data: presentation, error: presentationError } = await this.supabase
      .from('presentations')
      .insert({
        id: presentationId,
        title,
        current_slide_index: 0,
        present_mode: false
      })
      .select()
      .single();

    if (presentationError) {
      throw new Error(`Failed to create presentation: ${presentationError.message}`);
    }

    // Create default slide
    const { error: slideError } = await this.supabase
      .from('slides')
      .insert({
        id: slideId,
        presentation_id: presentationId,
        title: 'Untitled Slide',
        slide_order: 0
      });

    if (slideError) {
      throw new Error(`Failed to create default slide: ${slideError.message}`);
    }

    return presentation;
  }

  async getPresentationById(id: string): Promise<Presentation | null> {
    const { data, error } = await this.supabase
      .from('presentations')
      .select(`
        *,
        slides (
          *,
          text_blocks (*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch presentation: ${error.message}`);
    }

    // Sort slides by order and text blocks by creation time
    if (data.slides) {
      data.slides.sort((a: any, b: any) => a.slide_order - b.slide_order);
      data.slides.forEach((slide: any) => {
        if (slide.text_blocks) {
          slide.text_blocks.sort((a: any, b: any) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        }
      });
    }

    return data;
  }

  async updatePresentation(id: string, updates: Partial<Presentation>): Promise<Presentation> {
    const { data, error } = await this.supabase
      .from('presentations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update presentation: ${error.message}`);
    }

    return data;
  }

  async deletePresentation(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('presentations')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete presentation: ${error.message}`);
    }
  }

  // Slide operations
  async createSlide(presentationId: string, title: string = 'Untitled Slide'): Promise<Slide> {
    // Get the current max slide order
    const { data: maxOrderData } = await this.supabase
      .from('slides')
      .select('slide_order')
      .eq('presentation_id', presentationId)
      .order('slide_order', { ascending: false })
      .limit(1);

    const nextOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].slide_order + 1 : 0;

    const { data, error } = await this.supabase
      .from('slides')
      .insert({
        id: uuidv4(),
        presentation_id: presentationId,
        title,
        slide_order: nextOrder
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create slide: ${error.message}`);
    }

    return data;
  }

  async updateSlide(id: string, updates: Partial<Slide>): Promise<Slide> {
    const { data, error } = await this.supabase
      .from('slides')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update slide: ${error.message}`);
    }

    return data;
  }

  async deleteSlide(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('slides')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete slide: ${error.message}`);
    }
  }

  // Text block operations
  async createTextBlock(slideId: string, textBlock: Omit<TextBlock, 'id' | 'slide_id'>): Promise<TextBlock> {
    const { data, error } = await this.supabase
      .from('text_blocks')
      .insert({
        id: uuidv4(),
        slide_id: slideId,
        ...textBlock
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create text block: ${error.message}`);
    }

    return data;
  }

  async updateTextBlock(id: string, updates: Partial<TextBlock>): Promise<TextBlock> {
    const { data, error } = await this.supabase
      .from('text_blocks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update text block: ${error.message}`);
    }

    return data;
  }

  async deleteTextBlock(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('text_blocks')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete text block: ${error.message}`);
    }
  }

  // User operations
  async addUserToPresentation(presentationId: string, nickname: string, role: 'owner' | 'editor' | 'viewer', socketId?: string): Promise<PresentationUser> {
    const { data, error } = await this.supabase
      .from('presentation_users')
      .insert({
        id: uuidv4(),
        presentation_id: presentationId,
        nickname,
        role,
        socket_id: socketId,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add user to presentation: ${error.message}`);
    }

    return data;
  }

  async updateUserRole(presentationId: string, userId: string, role: 'owner' | 'editor' | 'viewer'): Promise<PresentationUser> {
    const { data, error } = await this.supabase
      .from('presentation_users')
      .update({ role })
      .eq('id', userId)
      .eq('presentation_id', presentationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }

    return data;
  }

  async removeUserFromPresentation(presentationId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('presentation_users')
      .update({ is_active: false })
      .eq('id', userId)
      .eq('presentation_id', presentationId);

    if (error) {
      throw new Error(`Failed to remove user from presentation: ${error.message}`);
    }
  }

  async removeUserBySocketId(socketId: string): Promise<void> {
    const { error } = await this.supabase
      .from('presentation_users')
      .update({ is_active: false })
      .eq('socket_id', socketId);

    if (error) {
      throw new Error(`Failed to remove user by socket ID: ${error.message}`);
    }
  }

  // Additional slide operations
  async addSlide(presentationId: string, title: string, content: any[], index: number): Promise<Slide> {
    const { data, error } = await this.supabase
      .from('slides')
      .insert({
        id: uuidv4(),
        presentation_id: presentationId,
        title,
        slide_order: index
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add slide: ${error.message}`);
    }

    return data;
  }

  async removeSlide(slideId: string): Promise<void> {
    const { error } = await this.supabase
      .from('slides')
      .delete()
      .eq('id', slideId);

    if (error) {
      throw new Error(`Failed to remove slide: ${error.message}`);
    }
  }

  async updateSlideIndex(slideId: string, newIndex: number): Promise<void> {
    const { error } = await this.supabase
      .from('slides')
      .update({ slide_order: newIndex })
      .eq('id', slideId);

    if (error) {
      throw new Error(`Failed to update slide index: ${error.message}`);
    }
  }

  // Text block operations with proper interface
  async addTextBlock(slideId: string, textBlock: Omit<TextBlock, 'id' | 'slide_id'>): Promise<TextBlock> {
    const { data, error } = await this.supabase
      .from('text_blocks')
      .insert({
        id: uuidv4(),
        slide_id: slideId,
        ...textBlock
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add text block: ${error.message}`);
    }

    return data;
  }

  async removeTextBlock(textBlockId: string): Promise<void> {
    const { error } = await this.supabase
      .from('text_blocks')
      .delete()
      .eq('id', textBlockId);

    if (error) {
      throw new Error(`Failed to remove text block: ${error.message}`);
    }
  }

  async updateUserSocketId(userId: string, socketId: string): Promise<void> {
    const { error } = await this.supabase
      .from('presentation_users')
      .update({ socket_id: socketId, last_seen: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update user socket: ${error.message}`);
    }
  }

  async setUserInactive(socketId: string): Promise<void> {
    const { error } = await this.supabase
      .from('presentation_users')
      .update({ is_active: false, last_seen: new Date().toISOString() })
      .eq('socket_id', socketId);

    if (error) {
      throw new Error(`Failed to set user inactive: ${error.message}`);
    }
  }

  async getPresentationUsers(presentationId: string): Promise<PresentationUser[]> {
    const { data, error } = await this.supabase
      .from('presentation_users')
      .select('*')
      .eq('presentation_id', presentationId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch presentation users: ${error.message}`);
    }

    return data || [];
  }

  async getUserBySocketId(socketId: string): Promise<PresentationUser | null> {
    const { data, error } = await this.supabase
      .from('presentation_users')
      .select('*')
      .eq('socket_id', socketId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch user by socket: ${error.message}`);
    }

    return data;
  }

  // Cleanup inactive users (called periodically)
  async cleanupInactiveUsers(inactiveThresholdMinutes: number = 30): Promise<void> {
    const thresholdTime = new Date(Date.now() - inactiveThresholdMinutes * 60 * 1000).toISOString();
    
    const { error } = await this.supabase
      .from('presentation_users')
      .update({ is_active: false })
      .lt('last_seen', thresholdTime)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to cleanup inactive users:', error);
    }
  }
}

export default DatabaseService;
export { DatabaseService };