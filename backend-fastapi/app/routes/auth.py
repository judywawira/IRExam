from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field, field_validator
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from app.config import get_settings
from app.models.user import User, UserRole
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=72)
    firstName: str
    lastName: str
    role: UserRole = UserRole.STUDENT

    @field_validator('password')
    @classmethod
    def validate_password_bytes(cls, v: str) -> str:
        if len(v.encode('utf-8')) > 72:
            raise ValueError('Password cannot exceed 72 bytes')
        return v

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    user: dict

class UserResponse(BaseModel):
    id: str
    email: str
    firstName: str
    lastName: str
    role: str
    isApproved: bool
    isArchived: bool

def create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.jwt_expiration_days)
    return jwt.encode({"user_id": user_id, "exp": expire}, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def user_to_response(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "firstName": user.firstName,
        "lastName": user.lastName,
        "role": user.role.value,
        "isApproved": user.isApproved,
        "isArchived": user.isArchived
    }

@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    existing = await User.find_one(User.email == req.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Ensure password doesn't exceed bcrypt's 72-byte limit
    password_bytes = req.password.encode('utf-8')
    if len(password_bytes) > 72:
        password_to_hash = password_bytes[:72].decode('utf-8', errors='ignore')
    else:
        password_to_hash = req.password

    hashed_password = pwd_context.hash(password_to_hash)
    is_approved = req.role == UserRole.ADMIN

    user = User(
        email=req.email,
        password=hashed_password,
        firstName=req.firstName,
        lastName=req.lastName,
        role=req.role,
        isApproved=is_approved
    )
    await user.insert()

    token = create_token(str(user.id))
    return {"token": token, "user": user_to_response(user)}

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await User.find_one(User.email == req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Truncate password if needed for bcrypt verification
    password_bytes = req.password.encode('utf-8')
    if len(password_bytes) > 72:
        password_to_verify = password_bytes[:72].decode('utf-8', errors='ignore')
    else:
        password_to_verify = req.password

    if not pwd_context.verify(password_to_verify, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(str(user.id))
    return {"token": token, "user": user_to_response(user)}

@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return user_to_response(user)
