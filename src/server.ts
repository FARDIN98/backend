import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import DatabaseService, { Presentation, Slide, TextBlock, PresentationUser } from './services/database';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Initialize Database Service
let db: DatabaseService | null = null;
let useDatabase = false;

try {
  db = new DatabaseService();
  useDatabase = true;
  console.log('✅ Database service initialized');
  
  // Test connection
  db.testConnection().then((connected: boolean) => {
    if (connected) {
      console.log('✅ Database connection verified');
    } else {
      console.error('❌ Database connection failed');
      process.exit(1);
    }
  });
} catch (error) {
  console.error('❌ Failed to initialize database service:', error);
  console.log('💡 Please check your Supabase configuration in .env file');
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Active connections tracking
const activePresentations = new Map<string, Set<string>>(); // presentationId -> Set of socketIds
const userSockets = new Map<string, string>(); // userId -> socketId
const socketUsers = new Map<string, string>(); // socketId -> userId

// Helper functions
const broadcastToPresentation = (presentationId: string, event: string, data: any) => {
  const sockets = activePresentations.get(presentationId);
  if (sockets) {
    sockets.forEach(socketId => {
      io.to(socketId).emit(event, data);
    });
  }
};

const addSocketToPresentation = (presentationId: string, socketId: string) => {
  if (!activePresentations.has(presentationId)) {
    activePresentations.set(presentationId, new Set());
  }
  activePresentations.get(presentationId)!.add(socketId);
};

const removeSocketFromPresentation = (presentationId: string, socketId: string) => {
  const sockets = activePresentations.get(presentationId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      activePresentations.delete(presentationId);
    }
  }
};

// Cleanup inactive users every 5 minutes
setInterval(async () => {
  if (db) {
    try {
      await db.cleanupInactiveUsers(30); // 30 minutes threshold
    } catch (error) {
      console.error('Error cleaning up inactive users:', error);
    }
  }
}, 5 * 60 * 1000);

// API Routes
app.get('/api/presentations', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const presentations = await db.getAllPresentations();
    return res.json(presentations);
  } catch (error) {
    console.error('Error fetching presentations:', error);
    return res.status(500).json({ error: 'Failed to fetch presentations' });
  }
});

app.post('/api/presentations', async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const presentation = await db.createPresentation(title);
    return res.status(201).json(presentation);
  } catch (error) {
    console.error('Error creating presentation:', error);
    return res.status(500).json({ error: 'Failed to create presentation' });
  }
});

app.get('/api/presentations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const presentation = await db.getPresentationById(id);
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    
    return res.json(presentation);
  } catch (error) {
    console.error('Error fetching presentation:', error);
    return res.status(500).json({ error: 'Failed to fetch presentation' });
  }
});

app.put('/api/presentations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const presentation = await db.updatePresentation(id, updates);
    
    // Broadcast updates to connected clients
    broadcastToPresentation(id, 'presentation-updated', presentation);
    
    return res.json(presentation);
  } catch (error) {
    console.error('Error updating presentation:', error);
    return res.status(500).json({ error: 'Failed to update presentation' });
  }
});

app.delete('/api/presentations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    await db.deletePresentation(id);

    // Remove from active presentations and disconnect all users
    const sockets = activePresentations.get(id);
    if (sockets) {
      sockets.forEach(socketId => {
        io.to(socketId).emit('presentation-deleted', { presentationId: id });
      });
      activePresentations.delete(id);
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting presentation:', error);
    return res.status(500).json({ error: 'Failed to delete presentation' });
  }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-presentation', async (data: { presentationId: string; nickname: string; role?: 'owner' | 'editor' | 'viewer' }) => {
    try {
      const { presentationId, nickname, role = 'viewer' } = data;
      
      if (!db) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      // Fetch presentation from database
      const presentation = await db.getPresentationById(presentationId);
      if (!presentation) {
        socket.emit('error', { message: 'Presentation not found' });
        return;
      }

      // Add user to presentation in database
      const user = await db.addUserToPresentation(presentationId, nickname, role, socket.id);
      
      // Track socket connections
      addSocketToPresentation(presentationId, socket.id);
      userSockets.set(user.id, socket.id);
      socketUsers.set(socket.id, user.id);
      
      // Join socket room
      socket.join(presentationId);
      
      // Send current presentation state to user
      const users = await db.getPresentationUsers(presentationId);
      socket.emit('presentation-joined', { 
        presentation, 
        user, 
        users 
      });
      
      // Notify other users
      socket.to(presentationId).emit('user-joined', user);
      
      console.log(`User ${nickname} joined presentation ${presentationId}`);
    } catch (error) {
      console.error('Error joining presentation:', error);
      socket.emit('error', { message: 'Failed to join presentation' });
    }
  });

  socket.on('leave-presentation', async (data: { presentationId: string; userId: string }) => {
    try {
      const { presentationId, userId } = data;
      
      if (!db) {
        return;
      }

      // Remove user from presentation in database
      await db.removeUserFromPresentation(presentationId, userId);
      
      // Remove from socket tracking
      removeSocketFromPresentation(presentationId, socket.id);
      userSockets.delete(userId);
      socketUsers.delete(socket.id);
      
      // Leave socket room
      socket.leave(presentationId);
      
      // Notify other users
      socket.to(presentationId).emit('user-left', { userId });
      
      console.log(`User ${userId} left presentation ${presentationId}`);
    } catch (error) {
      console.error('Error leaving presentation:', error);
    }
  });

  socket.on('add-slide', async (data: { presentationId: string; title?: string; index?: number }) => {
    try {
      const { presentationId, title = 'Untitled Slide', index = 0 } = data;
      
      if (!db) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      // Add slide to database
      const newSlide = await db.addSlide(presentationId, title, [], index);

      // Broadcast to all users in the presentation
      broadcastToPresentation(presentationId, 'slide-added', newSlide);
    } catch (error) {
      console.error('Error adding slide:', error);
      socket.emit('error', { message: 'Failed to add slide' });
    }
  });

  socket.on('remove-slide', async (data: { presentationId: string; slideId: string }) => {
    try {
      const { presentationId, slideId } = data;
      
      if (!db) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      // Remove slide from database
      await db.removeSlide(slideId);

      // Broadcast to all users in the presentation
      broadcastToPresentation(presentationId, 'slide-removed', { slideId });
    } catch (error) {
      console.error('Error removing slide:', error);
      socket.emit('error', { message: 'Failed to remove slide' });
    }
  });

  socket.on('update-slide-index', async (data: { presentationId: string; slideId: string; newIndex: number }) => {
    try {
      const { presentationId, slideId, newIndex } = data;
      
      if (!db) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      // Update slide index in database
      await db.updateSlideIndex(slideId, newIndex);

      // Get updated slides
      const presentation = await db.getPresentationById(presentationId);
      if (presentation) {
        broadcastToPresentation(presentationId, 'slide-index-updated', { slides: presentation.slides });
      }
    } catch (error) {
      console.error('Error updating slide index:', error);
      socket.emit('error', { message: 'Failed to update slide index' });
    }
  });

  socket.on('update-current-slide', async (data: { presentationId: string; slideIndex: number }) => {
    try {
      const { presentationId, slideIndex } = data;
      
      if (!db) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      // Update current slide index in database
       await db.updatePresentation(presentationId, { current_slide_index: slideIndex });

      // Broadcast to all users in the presentation
      broadcastToPresentation(presentationId, 'current-slide-updated', { slideIndex });
    } catch (error) {
      console.error('Error updating current slide:', error);
      socket.emit('error', { message: 'Failed to update current slide' });
    }
  });

  socket.on('add-text-block', async (data: { presentationId: string; slideId: string; textBlock: Omit<TextBlock, 'id'> }) => {
    try {
      const { presentationId, slideId, textBlock } = data;
      
      if (!db) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      // Add text block to database
      const newTextBlock = await db.addTextBlock(slideId, textBlock);

      // Broadcast to all users in the presentation
      broadcastToPresentation(presentationId, 'text-block-added', { slideId, textBlock: newTextBlock });
    } catch (error) {
      console.error('Error adding text block:', error);
      socket.emit('error', { message: 'Failed to add text block' });
    }
  });

  socket.on('update-text-block', async (data: { presentationId: string; slideId: string; textBlock: TextBlock }) => {
    try {
      const { presentationId, slideId, textBlock } = data;
      
      if (!db) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      // Update text block in database
      const updatedTextBlock = await db.updateTextBlock(textBlock.id, textBlock);

      // Broadcast to all users in the presentation
      broadcastToPresentation(presentationId, 'text-block-updated', { slideId, textBlock: updatedTextBlock });
    } catch (error) {
      console.error('Error updating text block:', error);
      socket.emit('error', { message: 'Failed to update text block' });
    }
  });

  socket.on('remove-text-block', async (data: { presentationId: string; slideId: string; textBlockId: string }) => {
    try {
      const { presentationId, slideId, textBlockId } = data;
      
      if (!db) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      // Remove text block from database
      await db.removeTextBlock(textBlockId);

      // Broadcast to all users in the presentation
      broadcastToPresentation(presentationId, 'text-block-removed', { slideId, textBlockId });
    } catch (error) {
      console.error('Error removing text block:', error);
      socket.emit('error', { message: 'Failed to remove text block' });
    }
  });

  socket.on('update-user-role', async (data: { presentationId: string; userId: string; role: 'owner' | 'editor' | 'viewer' }) => {
    try {
      const { presentationId, userId, role } = data;
      
      if (!db) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      // Update user role in database
      await db.updateUserRole(presentationId, userId, role);
      
      // Broadcast to all users in the presentation
      broadcastToPresentation(presentationId, 'user-role-updated', { userId, role });
    } catch (error) {
      console.error('Error updating user role:', error);
      socket.emit('error', { message: 'Failed to update user role' });
    }
  });

  socket.on('enter-present-mode', async (data: { presentationId: string }) => {
    try {
      const { presentationId } = data;
      
      if (!db) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      // Update presentation to enter present mode
       await db.updatePresentation(presentationId, { present_mode: true });
      
      // Broadcast to all users in the presentation
      broadcastToPresentation(presentationId, 'present-mode-entered', {});
    } catch (error) {
      console.error('Error entering present mode:', error);
      socket.emit('error', { message: 'Failed to enter present mode' });
    }
  });

  socket.on('exit-present-mode', async (data: { presentationId: string }) => {
    try {
      const { presentationId } = data;
      
      if (!db) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      // Update presentation to exit present mode
       await db.updatePresentation(presentationId, { present_mode: false });
      
      // Broadcast to all users in the presentation
      broadcastToPresentation(presentationId, 'present-mode-exited', {});
    } catch (error) {
      console.error('Error exiting present mode:', error);
      socket.emit('error', { message: 'Failed to exit present mode' });
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    try {
      const userId = socketUsers.get(socket.id);
      if (userId && db) {
        // Remove user from database
        await db.removeUserBySocketId(socket.id);
        
        // Clean up socket tracking
        userSockets.delete(userId);
        socketUsers.delete(socket.id);
        
        // Remove from active presentations and notify other users
        for (const [presentationId, sockets] of activePresentations) {
          if (sockets.has(socket.id)) {
            removeSocketFromPresentation(presentationId, socket.id);
            socket.to(presentationId).emit('user-left', { userId });
          }
        }
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});