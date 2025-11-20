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
        const session = await ExamSession.findById(sessionId);

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        session.currentCaseIndex = caseIndex;
        session.currentImageIndex = imageIndex;
        session.lastUpdated = new Date();
        await session.save();

        // Broadcast to all participants
        io.to(sessionId).emit('image-changed', {
          caseIndex,
          imageIndex
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

    // Handle disconnect
    socket.on('disconnect', () => {
      // Connection closed
    });
  });
};
