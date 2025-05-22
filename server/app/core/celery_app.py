
from app.core.config import get_settings
from celery import Celery
from celery.schedules import crontab

settings = get_settings()

# Ensure that the DJANGO_SETTINGS_MODULE environment variable is set correctly
# For FastAPI, this might not be needed unless you are using Django components.
# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'your_project.settings')

# Default to local Redis if not specified by environment variable
# redis_host = os.getenv("REDIS_HOST", "redis") # Service name from docker-compose
# redis_port = os.getenv("REDIS_PORT", "6379")

# CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', f'redis://{redis_host}:{redis_port}/0')
# CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', f'redis://{redis_host}:{redis_port}/1')

CELERY_BROKER_URL = settings.CELERY_BROKER_URL
CELERY_RESULT_BACKEND = settings.CELERY_RESULT_BACKEND

celery = Celery(
    __name__, # Using __name__ will make the app name 'app.core.celery_app'
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=['app.workers.tasks']  # List of modules to import when the worker starts
)

# Optional Celery configuration, see Celery docs for more options
celery.conf.update(
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone='UTC',
    enable_utc=True,
    # Optional: set a default task execution time limit
    # task_time_limit=300, # 5 minutes
    # Optional: set a default task soft time limit
    # task_soft_time_limit=240, # 4 minutes
)

# Define periodic tasks (Celery Beat schedule)
celery.conf.beat_schedule = {
    'schedule-hourly-feed-refreshes': {
        'task': 'app.workers.tasks.schedule_all_feed_refreshes_task',
        # 'schedule': crontab(minute=0),  # Every hour at minute 0
        'schedule': crontab(minute='*/30'), # Every 30 minutes for more frequent updates during dev/testing
        # 'args': (16, 16), # Example arguments for the task, if any
    },
    # You can add more periodic tasks here
}

if __name__ == '__main__':
    # This allows running celery worker directly using: python -m app.core.celery_app worker -l info
    # (Though typically you'd use the `celery` CLI command from docker-compose)
    celery.start() 