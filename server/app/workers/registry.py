"""
Task Registry.

This module imports all task modules to ensure they are registered
with the Taskiq broker when the worker starts.

If you add a new task file, import it here.
"""

# Import the modules containing @broker.task decorators
