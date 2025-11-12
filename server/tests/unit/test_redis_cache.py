"""Tests for Redis cache serialization functionality."""

import json
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

import pytest
from pydantic import BaseModel

from app.core.redis_cache import ExtendedJSONEncoder, _serialize_value


class SampleEnum(Enum):
    """Sample enum for serialization tests."""

    VALUE_ONE = "value1"
    VALUE_TWO = "value2"


class SampleModel(BaseModel):
    """Sample Pydantic model for serialization tests."""

    name: str
    created_at: datetime


class TestExtendedJSONEncoder:
    """Test ExtendedJSONEncoder functionality."""

    def test_datetime_serialization(self):
        """Test datetime serialization to ISO format."""
        dt = datetime(2025, 1, 15, 10, 30, 45, tzinfo=timezone.utc)
        result = json.dumps(dt, cls=ExtendedJSONEncoder)
        assert result == '"2025-01-15T10:30:45+00:00"'

    def test_datetime_without_timezone(self):
        """Test datetime serialization without timezone."""
        dt = datetime(2025, 1, 15, 10, 30, 45)
        result = json.dumps(dt, cls=ExtendedJSONEncoder)
        assert result == '"2025-01-15T10:30:45"'

    def test_uuid_serialization(self):
        """Test UUID serialization to string."""
        test_uuid = UUID("12345678-1234-5678-1234-567812345678")
        result = json.dumps(test_uuid, cls=ExtendedJSONEncoder)
        assert result == '"12345678-1234-5678-1234-567812345678"'

    def test_enum_serialization(self):
        """Test Enum serialization to value."""
        result = json.dumps(SampleEnum.VALUE_ONE, cls=ExtendedJSONEncoder)
        assert result == '"value1"'

    def test_decimal_serialization(self):
        """Test Decimal serialization to float."""
        decimal_value = Decimal("123.45")
        result = json.dumps(decimal_value, cls=ExtendedJSONEncoder)
        assert result == "123.45"

    def test_nested_datetime_in_dict(self):
        """Test datetime serialization within a dictionary."""
        dt = datetime(2025, 1, 15, 10, 30, 45, tzinfo=timezone.utc)
        data = {"timestamp": dt, "name": "test"}
        result = json.dumps(data, cls=ExtendedJSONEncoder)
        parsed = json.loads(result)
        assert parsed["timestamp"] == "2025-01-15T10:30:45+00:00"
        assert parsed["name"] == "test"

    def test_nested_uuid_in_list(self):
        """Test UUID serialization within a list."""
        test_uuid = uuid4()
        data = ["item1", test_uuid, "item2"]
        result = json.dumps(data, cls=ExtendedJSONEncoder)
        parsed = json.loads(result)
        assert parsed[0] == "item1"
        assert parsed[1] == str(test_uuid)
        assert parsed[2] == "item2"

    def test_complex_nested_structure(self):
        """Test serialization of complex nested structures."""
        dt = datetime(2025, 1, 15, 10, 30, 45, tzinfo=timezone.utc)
        test_uuid = uuid4()
        data = {
            "id": test_uuid,
            "created_at": dt,
            "status": SampleEnum.VALUE_ONE,
            "price": Decimal("99.99"),
            "nested": {"timestamp": dt, "count": 5},
            "items": [dt, test_uuid],
        }
        result = json.dumps(data, cls=ExtendedJSONEncoder)
        parsed = json.loads(result)

        assert parsed["id"] == str(test_uuid)
        assert parsed["created_at"] == "2025-01-15T10:30:45+00:00"
        assert parsed["status"] == "value1"
        assert parsed["price"] == 99.99
        assert parsed["nested"]["timestamp"] == "2025-01-15T10:30:45+00:00"
        assert parsed["nested"]["count"] == 5
        assert parsed["items"][0] == "2025-01-15T10:30:45+00:00"
        assert parsed["items"][1] == str(test_uuid)


class TestSerializeValue:
    """Test _serialize_value function."""

    def test_simple_string(self):
        """Test simple string serialization."""
        result = _serialize_value("test string")
        assert result == '"test string"'

    def test_simple_int(self):
        """Test simple integer serialization."""
        result = _serialize_value(42)
        assert result == "42"

    def test_simple_float(self):
        """Test simple float serialization."""
        result = _serialize_value(3.14)
        assert result == "3.14"

    def test_simple_bool(self):
        """Test simple boolean serialization."""
        result = _serialize_value(True)
        assert result == "true"

    def test_none_value(self):
        """Test None serialization."""
        result = _serialize_value(None)
        assert result == "null"

    def test_datetime_value(self):
        """Test datetime serialization via _serialize_value."""
        dt = datetime(2025, 1, 15, 10, 30, 45, tzinfo=timezone.utc)
        result = _serialize_value(dt)
        assert result == '"2025-01-15T10:30:45+00:00"'

    def test_uuid_value(self):
        """Test UUID serialization via _serialize_value."""
        test_uuid = UUID("12345678-1234-5678-1234-567812345678")
        result = _serialize_value(test_uuid)
        assert result == '"12345678-1234-5678-1234-567812345678"'

    def test_pydantic_model(self):
        """Test Pydantic model serialization."""
        dt = datetime(2025, 1, 15, 10, 30, 45, tzinfo=timezone.utc)
        model = SampleModel(name="test", created_at=dt)
        result = _serialize_value(model)
        parsed = json.loads(result)
        assert parsed["name"] == "test"
        # Pydantic's mode="json" converts datetime to ISO format with 'Z' for UTC
        assert parsed["created_at"] == "2025-01-15T10:30:45Z"

    def test_dict_with_datetime(self):
        """Test dictionary with datetime values."""
        dt = datetime(2025, 1, 15, 10, 30, 45, tzinfo=timezone.utc)
        data = {"timestamp": dt, "name": "test"}
        result = _serialize_value(data)
        parsed = json.loads(result)
        assert parsed["timestamp"] == "2025-01-15T10:30:45+00:00"
        assert parsed["name"] == "test"

    def test_dict_with_pydantic_model(self):
        """Test dictionary containing Pydantic models."""
        dt = datetime(2025, 1, 15, 10, 30, 45, tzinfo=timezone.utc)
        model = SampleModel(name="test", created_at=dt)
        data = {"model": model, "count": 5}
        result = _serialize_value(data)
        parsed = json.loads(result)
        assert parsed["model"]["name"] == "test"
        assert parsed["model"]["created_at"] == "2025-01-15T10:30:45Z"
        assert parsed["count"] == 5

    def test_list_with_datetime(self):
        """Test list with datetime values."""
        dt = datetime(2025, 1, 15, 10, 30, 45, tzinfo=timezone.utc)
        data = [dt, "test", 123]
        result = _serialize_value(data)
        parsed = json.loads(result)
        assert parsed[0] == "2025-01-15T10:30:45+00:00"
        assert parsed[1] == "test"
        assert parsed[2] == 123

    def test_list_with_pydantic_models(self):
        """Test list containing Pydantic models."""
        dt1 = datetime(2025, 1, 15, 10, 30, 45, tzinfo=timezone.utc)
        dt2 = datetime(2025, 1, 16, 12, 0, 0, tzinfo=timezone.utc)
        model1 = SampleModel(name="test1", created_at=dt1)
        model2 = SampleModel(name="test2", created_at=dt2)
        data = [model1, model2]
        result = _serialize_value(data)
        parsed = json.loads(result)
        assert len(parsed) == 2
        assert parsed[0]["name"] == "test1"
        assert parsed[0]["created_at"] == "2025-01-15T10:30:45Z"
        assert parsed[1]["name"] == "test2"
        assert parsed[1]["created_at"] == "2025-01-16T12:00:00Z"

    def test_trending_feeds_structure(self):
        """Test serialization of trending feeds structure (real-world case)."""
        # This mirrors the structure that caused the original error
        dt = datetime(2025, 9, 10, 2, 9, 18, 478421, tzinfo=timezone.utc)
        feed_data = {
            "id": str(uuid4()),
            "title": "Test Feed",
            "description": "A test feed",
            "url": "https://example.com/feed.xml",
            "link": "https://example.com",
            "image_url": "https://example.com/image.png",
            "tags": ["tech", "science"],
            "language": "en",
            "category": "Technology",
            "popularity_score": 0.95,
            "created_at": dt,
            "updated_at": dt,
        }

        result = _serialize_value(feed_data)
        parsed = json.loads(result)

        assert parsed["title"] == "Test Feed"
        assert parsed["created_at"] == "2025-09-10T02:09:18.478421+00:00"
        assert parsed["updated_at"] == "2025-09-10T02:09:18.478421+00:00"
        assert parsed["popularity_score"] == 0.95

    def test_mixed_complex_structure(self):
        """Test serialization of complex mixed structures."""
        dt = datetime(2025, 1, 15, 10, 30, 45, tzinfo=timezone.utc)
        test_uuid = uuid4()
        model = SampleModel(name="test", created_at=dt)

        data = {
            "id": test_uuid,
            "model": model,
            "timestamp": dt,
            "enum": SampleEnum.VALUE_TWO,
            "decimal": Decimal("123.45"),
            "nested": {"deep": {"timestamp": dt, "uuid": test_uuid}},
            "list": [dt, test_uuid, model],
        }

        result = _serialize_value(data)
        parsed = json.loads(result)

        assert parsed["id"] == str(test_uuid)
        assert parsed["model"]["name"] == "test"
        assert parsed["model"]["created_at"] == "2025-01-15T10:30:45Z"  # Pydantic uses Z for UTC
        assert parsed["timestamp"] == "2025-01-15T10:30:45+00:00"  # Custom encoder uses +00:00
        assert parsed["enum"] == "value2"
        assert parsed["decimal"] == 123.45
        assert parsed["nested"]["deep"]["timestamp"] == "2025-01-15T10:30:45+00:00"
        assert parsed["nested"]["deep"]["uuid"] == str(test_uuid)
        assert len(parsed["list"]) == 3
        assert parsed["list"][0] == "2025-01-15T10:30:45+00:00"
        assert parsed["list"][1] == str(test_uuid)
        assert parsed["list"][2]["name"] == "test"
        assert parsed["list"][2]["created_at"] == "2025-01-15T10:30:45Z"
