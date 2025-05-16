from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class BookCreate(BaseModel):
    title: str
    author: Optional[str] = None
    format: str
    file_url: Optional[str] = None
    rag_enabled: bool = False

class BookProgress(BaseModel):
    epub_progress: Optional[Dict[str, Any]] = None
    pdf_current_page: Optional[int] = None

class BookResponse(BaseModel):
    id: str
    title: str
    author: Optional[str] = None
    format: str
    file_url: Optional[str] = None
    rag_enabled: bool = False
    epub_progress: Optional[Dict[str, Any]] = None
    pdf_current_page: Optional[int] = None

class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    format: Optional[str] = None
    file_url: Optional[str] = None
    rag_enabled: Optional[bool] = None
    epub_progress: Optional[Dict[str, Any]] = None
    pdf_current_page: Optional[int] = None 