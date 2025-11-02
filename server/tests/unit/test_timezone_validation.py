"""Unit tests for timezone validation."""

import pytest
import pytz
from pydantic import BaseModel, ValidationError, field_validator


class TimezoneTestModel(BaseModel):
    """Test model with timezone validation."""

    user_timezone: str | None = None

    @field_validator("user_timezone")
    @classmethod
    def validate_timezone(cls, v: str | None) -> str | None:
        """Validate timezone against IANA timezone database."""
        if v is None:
            return v

        if v not in pytz.all_timezones_set:
            raise ValueError(
                f"Invalid timezone '{v}'. Must be a valid IANA timezone "
                f"(e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo')"
            )
        return v


class TestTimezoneValidation:
    """Test timezone validation against IANA database."""

    def test_valid_timezone_america_new_york(self):
        """Test that valid America/New_York timezone is accepted."""
        model = TimezoneTestModel(user_timezone="America/New_York")
        assert model.user_timezone == "America/New_York"

    def test_valid_timezone_europe_london(self):
        """Test that valid Europe/London timezone is accepted."""
        model = TimezoneTestModel(user_timezone="Europe/London")
        assert model.user_timezone == "Europe/London"

    def test_valid_timezone_asia_tokyo(self):
        """Test that valid Asia/Tokyo timezone is accepted."""
        model = TimezoneTestModel(user_timezone="Asia/Tokyo")
        assert model.user_timezone == "Asia/Tokyo"

    def test_valid_timezone_utc(self):
        """Test that UTC timezone is accepted."""
        model = TimezoneTestModel(user_timezone="UTC")
        assert model.user_timezone == "UTC"

    def test_valid_timezone_australia_sydney(self):
        """Test that valid Australia/Sydney timezone is accepted."""
        model = TimezoneTestModel(user_timezone="Australia/Sydney")
        assert model.user_timezone == "Australia/Sydney"

    def test_none_timezone(self):
        """Test that None timezone is accepted."""
        model = TimezoneTestModel(user_timezone=None)
        assert model.user_timezone is None

    def test_invalid_timezone_string(self):
        """Test that invalid timezone string is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            TimezoneTestModel(user_timezone="Invalid/Timezone")

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("user_timezone",)
        assert "Invalid timezone" in errors[0]["msg"]
        assert "IANA" in errors[0]["msg"]

    def test_invalid_timezone_empty_string(self):
        """Test that empty string timezone is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            TimezoneTestModel(user_timezone="")

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("user_timezone",)

    def test_invalid_timezone_abbreviation(self):
        """Test that timezone abbreviations (EST, PST) are rejected.

        Note: EST is actually in pytz.all_timezones (it's a valid IANA timezone),
        so we test with a clearly invalid abbreviation instead.
        """
        with pytest.raises(ValidationError) as exc_info:
            TimezoneTestModel(user_timezone="XYZ")

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("user_timezone",)

    def test_invalid_timezone_offset(self):
        """Test that timezone offsets like '+05:30' are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            TimezoneTestModel(user_timezone="+05:30")

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("user_timezone",)

    def test_case_sensitive_timezone(self):
        """Test that timezone validation is case-sensitive."""
        with pytest.raises(ValidationError) as exc_info:
            TimezoneTestModel(user_timezone="america/new_york")  # lowercase

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("user_timezone",)

    def test_all_common_timezones(self):
        """Test that all common timezones are accepted."""
        common_timezones = [
            "America/New_York",
            "America/Chicago",
            "America/Los_Angeles",
            "America/Denver",
            "Europe/London",
            "Europe/Paris",
            "Europe/Berlin",
            "Asia/Tokyo",
            "Asia/Shanghai",
            "Asia/Kolkata",
            "Australia/Sydney",
            "Pacific/Auckland",
        ]
        for tz in common_timezones:
            model = TimezoneTestModel(user_timezone=tz)
            assert model.user_timezone == tz
