# This file ensures that all models are registered with SQLAlchemy's Base metadata

# Import the Base from the central location
from app.db.base_class import Base

from .rss_models import Article, Feed, Folder, Tag

# Import all your model classes here to ensure they are registered with Base.metadata
from .user_models import AuthUser, Profile

# If you have other model files, import their models here as well
# Example: from .another_model_file import AnotherModel 