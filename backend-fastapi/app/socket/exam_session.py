import socketio
from beanie import PydanticObjectId
from jose import jwt, JWTError
from datetime import datetime
from app.config import get_settings
from app.models.user import User
from app.models.session import ExamSession, SessionStatus

settings = get_settings()

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*'
)

async def get_user_from_token(token: str) -> User:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("user_id")
        if user_id:
            return await User.get(PydanticObjectId(user_id))
    except JWTError:
        pass
    return None

@sio.event
async def connect(sid, environ, auth):
    token = auth.get('token') if auth else None
    if not token:
        return False
    user = await get_user_from_token(token)
    if not user:
        return False
    await sio.save_session(sid, {'user_id': str(user.id), 'user_name': f"{user.firstName} {user.lastName}"})
    return True

@sio.event
async def disconnect(sid):
    session_data = await sio.get_session(sid)
    if session_data and 'room' in session_data:
        await sio.leave_room(sid, session_data['room'])

@sio.event
async def join_session(sid, data):
    session_id = data.get('sessionId')
    if not session_id:
        return
    session_data = await sio.get_session(sid)
    await sio.enter_room(sid, session_id)
    session_data['room'] = session_id
    await sio.save_session(sid, session_data)

    exam_session = await ExamSession.get(PydanticObjectId(session_id))
    if exam_session:
        await sio.emit('session-state', {
            'status': exam_session.status.value,
            'currentImageIndex': exam_session.currentImageIndex,
            'timeRemaining': exam_session.timeRemaining
        }, room=sid)

@sio.event
async def start_exam(sid, data):
    session_id = data.get('sessionId')
    exam_session = await ExamSession.get(PydanticObjectId(session_id))
    if exam_session:
        exam_session.status = SessionStatus.IN_PROGRESS
        exam_session.startedAt = datetime.utcnow()
        await exam_session.save()
        await sio.emit('exam-started', {'status': 'in_progress'}, room=session_id)

@sio.event
async def pause_exam(sid, data):
    session_id = data.get('sessionId')
    exam_session = await ExamSession.get(PydanticObjectId(session_id))
    if exam_session:
        exam_session.status = SessionStatus.PAUSED
        await exam_session.save()
        await sio.emit('exam-paused', {'status': 'paused'}, room=session_id)

@sio.event
async def resume_exam(sid, data):
    session_id = data.get('sessionId')
    exam_session = await ExamSession.get(PydanticObjectId(session_id))
    if exam_session:
        exam_session.status = SessionStatus.IN_PROGRESS
        await exam_session.save()
        await sio.emit('exam-resumed', {'status': 'in_progress'}, room=session_id)

@sio.event
async def next_image(sid, data):
    session_id = data.get('sessionId')
    exam_session = await ExamSession.get(PydanticObjectId(session_id))
    if exam_session:
        exam_session.currentImageIndex += 1
        await exam_session.save()
        await sio.emit('image-changed', {'currentImageIndex': exam_session.currentImageIndex}, room=session_id)

@sio.event
async def prev_image(sid, data):
    session_id = data.get('sessionId')
    exam_session = await ExamSession.get(PydanticObjectId(session_id))
    if exam_session and exam_session.currentImageIndex > 0:
        exam_session.currentImageIndex -= 1
        await exam_session.save()
        await sio.emit('image-changed', {'currentImageIndex': exam_session.currentImageIndex}, room=session_id)

@sio.event
async def go_to_image(sid, data):
    session_id = data.get('sessionId')
    index = data.get('index', 0)
    exam_session = await ExamSession.get(PydanticObjectId(session_id))
    if exam_session:
        exam_session.currentImageIndex = index
        await exam_session.save()
        await sio.emit('image-changed', {'currentImageIndex': index}, room=session_id)

@sio.event
async def update_timer(sid, data):
    session_id = data.get('sessionId')
    time_remaining = data.get('timeRemaining')
    exam_session = await ExamSession.get(PydanticObjectId(session_id))
    if exam_session:
        exam_session.timeRemaining = time_remaining
        await exam_session.save()
        await sio.emit('timer-update', {'timeRemaining': time_remaining}, room=session_id)

@sio.event
async def end_exam(sid, data):
    session_id = data.get('sessionId')
    exam_session = await ExamSession.get(PydanticObjectId(session_id))
    if exam_session:
        exam_session.status = SessionStatus.COMPLETED
        exam_session.completedAt = datetime.utcnow()
        await exam_session.save()
        await sio.emit('exam-ended', {'status': 'completed'}, room=session_id)
