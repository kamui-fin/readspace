from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.core.database import Base

class Highlight(Base):
    __tablename__ = "highlights"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    text = Column(String, nullable=False)
    page_number = Column(Integer, nullable=True)
    note = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="highlights")
    book = relationship("Book", back_populates="highlights") 