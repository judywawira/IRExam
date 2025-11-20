const jwt = require('jsonwebtoken');
const ExamSession = require('../models/ExamSession');
const Case = require('../models/Case');

module.exports = (io) => {
  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    // Join exam session room
    socket.on('join-session', async (sessionId) => {
      try {
        const session = await ExamSession.findById(sessionId)
          .populate({
            path: 'exam',
            populate: { path: 'cases' }
          });

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        // Prevent non-admin users from accessing archived sessions
        if (session.isArchived && socket.userRole !== 'admin') {
          socket.emit('error', { message: 'This session has been archived and is no longer accessible.' });
          return;
        }

        socket.join(sessionId);
        socket.sessionId = sessionId;

        // Send current session state to the joining user
        socket.emit('session-state', {
          status: session.status,
          currentCaseIndex: session.currentCaseIndex,
          currentImageIndex: session.currentImageIndex,
          timeRemaining: session.timeRemaining,
          exam: session.exam
        });
      } catch (error) {
        console.error('Join session error:', error);
        socket.emit('error', { message: 'Error joining session' });
      }
    });

    // Start exam (Examiner only)
    socket.on('start-exam', async (sessionId) => {
      if (socket.userRole !== 'examiner' && socket.userRole !== 'admin') {
        socket.emit('error', { message: 'Only examiners can start exams' });
        return;
      }

      try {
        const session = await ExamSession.findById(sessionId).populate('exam');

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        session.status = 'active';
        session.startTime = new Date();
        session.lastUpdated = new Date();
        await session.save();

        // Track case usage for analytics
        if (session.exam && session.exam.cases) {
          for (const caseId of session.exam.cases) {
            await Case.findByIdAndUpdate(
              caseId,
              {
                $push: {
                  usageHistory: {
                    examSession: sessionId,
                    usedAt: new Date()
                  }
                }
              }
            );
          }
        }

        // Notify all participants
        io.to(sessionId).emit('exam-started', {
          startTime: session.startTime,
          timeRemaining: session.timeRemaining
        });
      } catch (error) {
        console.error('Start exam error:', error);
        socket.emit('error', { message: 'Error starting exam' });
      }
    });

    // Navigate to next/previous image (Examiner only)
    socket.on('navigate-image', async ({ sessionId, caseIndex, imageIndex }) => {
      if (socket.userRole !== 'examiner' && socket.userRole !== 'admin') {
        socket.emit('error', { message: 'Only examiners can navigate images' });
        return;
      }

      try {
        // Broadcast immediately to all participants for instant synchronization
        io.to(sessionId).emit('image-changed', {
          caseIndex,
          imageIndex
        });

        // Update database in background without blocking the broadcast
        ExamSession.findByIdAndUpdate(
          sessionId,
          {
            currentCaseIndex: caseIndex,
            currentImageIndex: imageIndex,
            lastUpdated: new Date()
          },
          { new: false }
        ).catch(error => {
          console.error('Background save error for navigation:', error);
        });
      } catch (error) {
        console.error('Navigate image error:', error);
        socket.emit('error', { message: 'Error navigating image' });
      }
    });

    // Update timer
    socket.on('update-timer', async ({ sessionId, timeRemaining }) => {
      if (socket.userRole !== 'examiner' && socket.userRole !== 'admin') {
        return;
      }

      try {
        const session = await ExamSession.findById(sessionId);

        if (!session) {
          return;
        }

        session.timeRemaining = timeRemaining;
        await session.save();

        // Broadcast timer update
        io.to(sessionId).emit('timer-update', { timeRemaining });

        // If time is up, end the exam
        if (timeRemaining <= 0) {
          session.status = 'completed';
          session.endTime = new Date();
          await session.save();

          io.to(sessionId).emit('exam-ended', {
            endTime: session.endTime
          });
        }
      } catch (error) {
        console.error('Update timer error:', error);
      }
    });

    // Pause exam (Examiner only)
    socket.on('pause-exam', async (sessionId) => {
      if (socket.userRole !== 'examiner' && socket.userRole !== 'admin') {
        socket.emit('error', { message: 'Only examiners can pause exams' });
        return;
      }

      try {
        const session = await ExamSession.findById(sessionId);

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        session.status = 'paused';
        await session.save();

        io.to(sessionId).emit('exam-paused');
      } catch (error) {
        console.error('Pause exam error:', error);
        socket.emit('error', { message: 'Error pausing exam' });
      }
    });

    // Resume exam (Examiner only)
    socket.on('resume-exam', async (sessionId) => {
      if (socket.userRole !== 'examiner' && socket.userRole !== 'admin') {
        socket.emit('error', { message: 'Only examiners can resume exams' });
        return;
      }

      try {
        const session = await ExamSession.findById(sessionId);

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        session.status = 'active';
        await session.save();

        io.to(sessionId).emit('exam-resumed');
      } catch (error) {
        console.error('Resume exam error:', error);
        socket.emit('error', { message: 'Error resuming exam' });
      }
    });

    // End exam (Examiner only)
    socket.on('end-exam', async (sessionId) => {
      if (socket.userRole !== 'examiner' && socket.userRole !== 'admin') {
        socket.emit('error', { message: 'Only examiners can end exams' });
        return;
      }

      try {
        const session = await ExamSession.findById(sessionId);

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        session.status = 'completed';
        session.endTime = new Date();
        await session.save();

        io.to(sessionId).emit('exam-ended', {
          endTime: session.endTime
        });
      } catch (error) {
        console.error('End exam error:', error);
        socket.emit('error', { message: 'Error ending exam' });
      }
    });

    // Annotation events - Real-time annotation synchronization
    socket.on('annotation-added', async ({ sessionId, caseId, annotation }) => {
      try {
        // Broadcast the annotation to all participants in the session
        io.to(sessionId).emit('annotation-added', {
          caseId,
          annotation: {
            ...annotation,
            createdBy: socket.userId,
            createdByRole: socket.userRole
          }
        });

        // Save to database
        const caseItem = await Case.findById(caseId);
        if (caseItem) {
          if (!caseItem.annotations) {
            caseItem.annotations = [];
          }
          caseItem.annotations.push({
            ...annotation,
            createdBy: socket.userId,
            createdByRole: socket.userRole
          });
          await caseItem.save();
        }
      } catch (error) {
        console.error('Add annotation error:', error);
        socket.emit('error', { message: 'Error adding annotation' });
      }
    });

    socket.on('annotation-updated', async ({ sessionId, caseId, annotationId, updates }) => {
      try {
        // Broadcast the update to all participants
        io.to(sessionId).emit('annotation-updated', {
          caseId,
          annotationId,
          updates
        });

        // Update in database
        const caseItem = await Case.findById(caseId);
        if (caseItem && caseItem.annotations) {
          const annotation = caseItem.annotations.id(annotationId);
          if (annotation) {
            // Only allow the creator to update their annotation
            if (annotation.createdBy.toString() === socket.userId) {
              Object.assign(annotation, updates);
              await caseItem.save();
            }
          }
        }
      } catch (error) {
        console.error('Update annotation error:', error);
        socket.emit('error', { message: 'Error updating annotation' });
      }
    });

    socket.on('annotation-deleted', async ({ sessionId, caseId, annotationId }) => {
      try {
        // Broadcast the deletion to all participants
        io.to(sessionId).emit('annotation-deleted', {
          caseId,
          annotationId
        });

        // Delete from database
        const caseItem = await Case.findById(caseId);
        if (caseItem && caseItem.annotations) {
          const annotation = caseItem.annotations.id(annotationId);
          if (annotation) {
            // Only allow the creator or admin to delete
            if (annotation.createdBy.toString() === socket.userId || socket.userRole === 'admin') {
              annotation.deleteOne();
              await caseItem.save();
            }
          }
        }
      } catch (error) {
        console.error('Delete annotation error:', error);
        socket.emit('error', { message: 'Error deleting annotation' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      // Connection closed
    });
  });
};
