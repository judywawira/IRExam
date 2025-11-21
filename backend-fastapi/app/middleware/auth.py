from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from beanie import PydanticObjectId
from app.config import get_settings
from app.models.user import User, UserRole
from typing import List

security = HTTPBearer()
settings = get_settings()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = await User.get(PydanticObjectId(user_id))
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.isApproved:
            raise HTTPException(status_code=403, detail="Account not approved")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(allowed_roles: List[UserRole]):
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

require_admin = require_roles([UserRole.ADMIN])
require_examiner_or_admin = require_roles([UserRole.ADMIN, UserRole.EXAMINER])
require_student = require_roles([UserRole.STUDENT])
