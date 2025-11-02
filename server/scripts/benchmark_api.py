"""
Benchmark API endpoints with comprehensive testing.

This script tests all RSS API routes with various parameters and measures:
- Response time
- Data transfer size
- Success rate
- Error patterns

Redis cache is flushed after each request to ensure accurate cold-start measurements.

Usage: python benchmark_api.py <base_url> <email> <password> [test_user_id] [output_filename]
Example: python benchmark_api.py http://localhost:8000 test@example.com password123
Example: python benchmark_api.py http://localhost:8000 test@example.com password123 123e4567-e89b-12d3-a456-426614174000
Example: python benchmark_api.py http://localhost:8000 test@example.com password123 123e4567-e89b-12d3-a456-426614174000 my_benchmark.json
"""

import asyncio
import json
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))


@dataclass
class BenchmarkResult:
    """Result of a single benchmark test."""

    endpoint: str
    method: str
    params: dict[str, Any]
    duration_ms: float
    response_size_bytes: int
    status_code: int
    success: bool
    error: str | None = None


class APIBenchmark:
    """API benchmarking tool."""

    def __init__(self, base_url: str, auth_token: str, user_id: UUID, output_filename: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.auth_token = auth_token
        self.user_id = user_id
        self.output_filename = output_filename
        self.results: list[BenchmarkResult] = []
        self.headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
        }

        # Store IDs for testing
        self.feed_ids: list[str] = []
        self.folder_ids: list[str] = []
        self.article_ids: list[str] = []
        self.real_feed_ids: list[str] = []  # Real RSS feeds for subscription testing
        self.redis_client = None

    async def _get_redis_client(self):
        """Get or create Redis client."""
        if self.redis_client is None:
            import redis.asyncio as redis

            from app.core.config import get_settings

            settings = get_settings()
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
        return self.redis_client

    async def _flush_redis(self):
        """Flush all Redis keys after each request for accurate benchmarking."""
        try:
            client = await self._get_redis_client()
            await client.flushall()
        except Exception as e:
            print(f"⚠️  Warning: Could not flush Redis: {e}")

    @staticmethod
    async def authenticate(base_url: str, email: str, password: str) -> tuple[str, UUID]:
        """Authenticate with Supabase and return access token and user ID."""
        print(f"🔐 Authenticating as {email}...")

        # Import Supabase client
        from supabase import create_client

        from app.core.config import get_settings

        settings = get_settings()

        # Create Supabase client
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY.get_secret_value())

        # Sign in with email and password
        try:
            response = supabase.auth.sign_in_with_password(
                {
                    "email": email,
                    "password": password,
                }
            )

            if not response.user or not response.session:
                raise Exception("Authentication failed: No user or session returned")

            access_token = response.session.access_token
            user_id = response.user.id

            print(f"✅ Authenticated successfully (User ID: {user_id})")
            return access_token, UUID(user_id)

        except Exception as e:
            raise Exception(f"Authentication failed: {str(e)}")

    async def make_request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json_data: dict[str, Any] | None = None,
    ) -> BenchmarkResult:
        """Make a single API request and measure performance."""
        url = f"{self.base_url}{endpoint}"

        start_time = time.perf_counter()
        error = None
        status_code = 0
        response_size = 0

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                if method == "GET":
                    response = await client.get(url, headers=self.headers, params=params)
                elif method == "POST":
                    response = await client.post(url, headers=self.headers, params=params, json=json_data)
                elif method == "PUT":
                    response = await client.put(url, headers=self.headers, params=params, json=json_data)
                elif method == "DELETE":
                    response = await client.delete(url, headers=self.headers, params=params)
                else:
                    raise ValueError(f"Unsupported method: {method}")

                status_code = response.status_code
                response_size = len(response.content)
                success = 200 <= status_code < 300

                # Try to parse JSON for data extraction
                if success and response.content:
                    try:
                        data = response.json()
                        # Extract IDs for later tests
                        if "items" in data and isinstance(data["items"], list):
                            for item in data["items"][:10]:  # Store first 10
                                if "id" in item:
                                    if endpoint.startswith("/api/rss/articles"):
                                        self.article_ids.append(item["id"])
                        elif "results" in data and isinstance(data["results"], list):
                            for item in data["results"][:10]:
                                if "id" in item:
                                    self.feed_ids.append(item["id"])
                        elif isinstance(data, list):
                            for item in data[:10]:
                                if "id" in item:
                                    if endpoint.startswith("/api/rss/folders"):
                                        self.folder_ids.append(item["id"])
                                    elif endpoint.startswith("/api/rss/feeds"):
                                        self.feed_ids.append(item["id"])
                    except Exception:
                        pass

        except Exception as e:
            error = str(e)
            success = False

        duration_ms = (time.perf_counter() - start_time) * 1000

        result = BenchmarkResult(
            endpoint=endpoint,
            method=method,
            params=params or {},
            duration_ms=duration_ms,
            response_size_bytes=response_size,
            status_code=status_code,
            success=success,
            error=error,
        )

        self.results.append(result)

        # Flush Redis cache after each request for accurate benchmarking
        await self._flush_redis()

        return result

    async def benchmark_folders(self):
        """Benchmark folder endpoints."""
        print("\n📁 Benchmarking Folders...")

        # List folders
        await self.make_request("GET", "/api/rss/folders/", params={"limit": 100})

        # Get specific folder (if we have IDs)
        if self.folder_ids:
            await self.make_request("GET", f"/api/rss/folders/{self.folder_ids[0]}")

    async def benchmark_feeds(self):
        """Benchmark feed endpoints."""
        print("\n🌐 Benchmarking Feeds...")

        # List all feeds
        await self.make_request("GET", "/api/rss/feeds/", params={"limit": 200})

        # List feeds with filters
        if self.folder_ids:
            await self.make_request("GET", "/api/rss/feeds/", params={"folder_id": self.folder_ids[0], "limit": 100})

        # List feeds with favorites filter
        await self.make_request("GET", "/api/rss/feeds/", params={"is_favorite": True, "limit": 50})

        # Get specific feed
        if self.feed_ids:
            await self.make_request("GET", f"/api/rss/feeds/{self.feed_ids[0]}")

        # Get trending feeds
        await self.make_request("GET", "/api/rss/feeds/trending", params={"limit": 20, "language": "en"})

    async def benchmark_articles(self):
        """Benchmark article endpoints."""
        print("\n📰 Benchmarking Articles...")

        # List articles - various page sizes
        for page_size in [20, 50, 100]:
            await self.make_request("GET", "/api/rss/articles/", params={"page": 1, "size": page_size})

        # List articles with filters
        if self.feed_ids:
            await self.make_request(
                "GET",
                "/api/rss/articles/",
                params={"feed_ids": self.feed_ids[0], "page": 1, "size": 50},
            )

        if self.folder_ids:
            await self.make_request(
                "GET",
                "/api/rss/articles/",
                params={"folder_id": self.folder_ids[0], "page": 1, "size": 50},
            )

        # Filter by read status
        await self.make_request("GET", "/api/rss/articles/", params={"is_read": False, "page": 1, "size": 50})

        await self.make_request("GET", "/api/rss/articles/", params={"is_read": True, "page": 1, "size": 50})

        # Filter by favorite
        await self.make_request("GET", "/api/rss/articles/", params={"is_favorite": True, "page": 1, "size": 50})

        # Filter by read later
        await self.make_request("GET", "/api/rss/articles/", params={"is_read_later": True, "page": 1, "size": 50})

        # Filter by date range
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        await self.make_request(
            "GET",
            "/api/rss/articles/",
            params={
                "published_since": week_ago.isoformat(),
                "published_until": now.isoformat(),
                "page": 1,
                "size": 50,
            },
        )

        # Sort variations
        for sort_by in ["published_at", "created_at", "title"]:
            for sort_order in ["asc", "desc"]:
                await self.make_request(
                    "GET",
                    "/api/rss/articles/",
                    params={"sort_by": sort_by, "sort_order": sort_order, "page": 1, "size": 20},
                )

        # Pagination stress test
        for page in [1, 2, 5, 10, 50]:
            await self.make_request("GET", "/api/rss/articles/", params={"page": page, "size": 20})

        # Today's articles
        await self.make_request("GET", "/api/rss/articles/today", params={"page": 1, "size": 25})

        # Recently read
        await self.make_request("GET", "/api/rss/articles/recently_read", params={"page": 1, "size": 20})

        # Read later
        await self.make_request("GET", "/api/rss/articles/read_later", params={"page": 1, "size": 100})

        # Unread counts
        await self.make_request("GET", "/api/rss/articles/unread_counts")

        if self.folder_ids:
            await self.make_request(
                "GET",
                "/api/rss/articles/unread_counts",
                params={"folder_id": self.folder_ids[0]},
            )

        # Get specific article
        if self.article_ids:
            await self.make_request("GET", f"/api/rss/articles/{self.article_ids[0]}")

    async def benchmark_discovery(self):
        """Benchmark discovery endpoints."""
        print("\n🔍 Benchmarking Discovery...")

        # Search feeds
        await self.make_request("GET", "/api/rss/discover/search", params={"limit": 40})

        await self.make_request("GET", "/api/rss/discover/search", params={"q": "technology", "limit": 40})

        await self.make_request(
            "GET",
            "/api/rss/discover/search",
            params={"category": "Technology & Programming", "limit": 40},
        )

        await self.make_request(
            "GET",
            "/api/rss/discover/search",
            params={"q": "news", "language": "en", "limit": 40},
        )

        # Get categories
        await self.make_request("GET", "/api/rss/discover/categories", params={"language": "en"})

        # Get category feeds
        await self.make_request(
            "GET",
            "/api/rss/discover/categories/Technology & Programming",
            params={"language": "en", "limit": 20},
        )

        # Recommendations
        await self.make_request(
            "POST",
            "/api/rss/discover/recommendations",
            json_data={
                "categories": ["Technology & Programming", "News & Politics"],
                "language": "en",
                "limit": 20,
            },
        )

    async def benchmark_similar_feeds(self):
        """Benchmark similar feeds endpoint (vector search)."""
        print("\n🔗 Benchmarking Similar Feeds (Vector Search)...")

        if self.feed_ids:
            # Test with different similarity thresholds
            for min_similarity in [0.1, 0.3, 0.5]:
                await self.make_request(
                    "GET",
                    f"/api/rss/similar/{self.feed_ids[0]}",
                    params={"limit": 10, "min_similarity": min_similarity},
                )

            # Test with different limits
            for limit in [5, 10, 20]:
                await self.make_request(
                    "GET",
                    f"/api/rss/similar/{self.feed_ids[0]}",
                    params={"limit": limit, "min_similarity": 0.1},
                )

    async def benchmark_feed_operations(self):
        """Benchmark real feed operations (subscribe, refresh, update)."""
        print("\n⚙️  Benchmarking Feed Operations...")

        # Get a real feed for testing
        discover_result = await self.make_request(
            "GET",
            "/api/rss/discover/search",
            params={"limit": 1},
        )

        # Subscribe to feed (if we have folders)
        # Note: This may fail with 429 if user has reached subscription limit
        if self.folder_ids and self.feed_ids:
            # Test subscription (skip if already at limit)
            result = await self.make_request(
                "POST",
                f"/api/rss/feeds/{self.feed_ids[0]}/subscribe",
                json_data={"folder_id": self.folder_ids[0]},
            )
            # 429 is expected if at subscription limit, don't count as failure
            if result.status_code == 429:
                print("  ℹ️  Skipping subscription test (user at subscription limit)")

        # Update feed (favorite toggle)
        if self.feed_ids:
            await self.make_request(
                "PUT",
                f"/api/rss/feeds/{self.feed_ids[0]}",
                json_data={"is_favorite": True},
            )

            # Update feed (rename)
            await self.make_request(
                "PUT",
                f"/api/rss/feeds/{self.feed_ids[0]}",
                json_data={"title": "Benchmark Test Feed Renamed"},
            )

            # Update feed (move to folder)
            if len(self.folder_ids) > 1:
                await self.make_request(
                    "PUT",
                    f"/api/rss/feeds/{self.feed_ids[0]}",
                    json_data={"folder_id": self.folder_ids[1]},
                )

        # Bulk operations
        if len(self.feed_ids) >= 5:
            # Bulk update folder
            await self.make_request(
                "POST",
                "/api/rss/feeds/bulk-update-folder",
                json_data={
                    "feed_ids": self.feed_ids[:5],
                    "folder_id": self.folder_ids[0] if self.folder_ids else None,
                },
            )

    async def benchmark_article_operations(self):
        """Benchmark article update operations (mark read, favorite, etc)."""
        print("\n📝 Benchmarking Article Operations...")

        if not self.article_ids:
            return

        # Mark as read
        await self.make_request(
            "PUT",
            f"/api/rss/articles/{self.article_ids[0]}",
            params={"article_type": "feed"},
            json_data={"is_read": True},
        )

        # Mark as favorite
        if len(self.article_ids) > 1:
            await self.make_request(
                "PUT",
                f"/api/rss/articles/{self.article_ids[1]}",
                params={"article_type": "feed"},
                json_data={"is_favorite": True},
            )

        # Mark as read later
        if len(self.article_ids) > 2:
            await self.make_request(
                "PUT",
                f"/api/rss/articles/{self.article_ids[2]}",
                params={"article_type": "feed"},
                json_data={"is_read_later": True},
            )

        # Combined update
        if len(self.article_ids) > 3:
            await self.make_request(
                "PUT",
                f"/api/rss/articles/{self.article_ids[3]}",
                params={"article_type": "feed"},
                json_data={
                    "is_read": True,
                    "is_favorite": True,
                    "is_read_later": False,
                },
            )

    async def benchmark_infinite_scroll_pattern(self):
        """Benchmark infinite scroll pattern (common in production)."""
        print("\n♾️  Benchmarking Infinite Scroll Pattern...")

        # Simulate loading first 3 pages quickly (typical user behavior)
        for page in [1, 2, 3]:
            await self.make_request(
                "GET",
                "/api/rss/articles/",
                params={"page": page, "size": 25, "sort_by": "published_at", "sort_order": "desc"},
            )

    async def benchmark_sidebar_data_pattern(self):
        """Benchmark sidebar data loading pattern."""
        print("\n📊 Benchmarking Sidebar Data Pattern...")

        # Typical sidebar load: folders + feeds + unread counts
        # These would normally be loaded in parallel
        tasks = [
            self.make_request("GET", "/api/rss/folders/"),
            self.make_request("GET", "/api/rss/feeds/", params={"limit": 200}),
            self.make_request("GET", "/api/rss/articles/unread_counts"),
        ]

        # Execute in parallel (simulating real app behavior)
        await asyncio.gather(*tasks)

    async def run_all_benchmarks(self):
        """Run all benchmark tests."""
        print("=" * 80)
        print("🚀 STARTING API BENCHMARKS")
        print("=" * 80)
        print(f"Base URL: {self.base_url}")
        print(f"User ID: {self.user_id}")
        print("Cache: Flushed after each request (cold-start measurements)")
        print(f"Time: {datetime.now().isoformat()}")

        start_time = time.perf_counter()

        # Run benchmarks in order
        await self.benchmark_folders()
        await self.benchmark_feeds()
        await self.benchmark_articles()
        await self.benchmark_discovery()
        await self.benchmark_similar_feeds()

        # Production usage patterns
        await self.benchmark_feed_operations()
        await self.benchmark_article_operations()
        await self.benchmark_infinite_scroll_pattern()
        await self.benchmark_sidebar_data_pattern()

        total_duration = time.perf_counter() - start_time

        # Print results
        self.print_results(total_duration)

    def print_results(self, total_duration: float):
        """Print benchmark results."""
        print("\n" + "=" * 80)
        print("📊 BENCHMARK RESULTS")
        print("=" * 80)

        # Group by endpoint
        endpoint_stats: dict[str, list[BenchmarkResult]] = {}
        for result in self.results:
            key = f"{result.method} {result.endpoint}"
            if key not in endpoint_stats:
                endpoint_stats[key] = []
            endpoint_stats[key].append(result)

        # Print summary for each endpoint
        print(f"\n{'Endpoint':<60} {'Calls':<8} {'Avg (ms)':<12} {'Min (ms)':<12} {'Max (ms)':<12} {'Avg Size':<12}")
        print("-" * 120)

        total_calls = 0
        total_failures = 0
        total_data_transferred = 0

        for endpoint, results in sorted(endpoint_stats.items()):
            durations = [r.duration_ms for r in results]
            sizes = [r.response_size_bytes for r in results]
            failures = sum(1 for r in results if not r.success)

            avg_duration = sum(durations) / len(durations)
            min_duration = min(durations)
            max_duration = max(durations)
            avg_size = sum(sizes) / len(sizes)

            total_calls += len(results)
            total_failures += failures
            total_data_transferred += sum(sizes)

            status = "✅" if failures == 0 else f"❌ ({failures} failed)"

            print(
                f"{endpoint:<60} {len(results):<8} {avg_duration:<12.2f} {min_duration:<12.2f} "
                f"{max_duration:<12.2f} {self.format_bytes(avg_size):<12} {status}"
            )

        # Overall statistics
        print("\n" + "=" * 80)
        print("📈 OVERALL STATISTICS")
        print("=" * 80)
        print(f"Total API Calls: {total_calls}")
        print(f"Total Failures: {total_failures}")
        print(f"Success Rate: {((total_calls - total_failures) / total_calls * 100):.2f}%")
        print(f"Total Data Transferred: {self.format_bytes(total_data_transferred)}")
        print(f"Total Duration: {total_duration:.2f}s")
        print(f"Average Call Duration: {(sum(r.duration_ms for r in self.results) / len(self.results)):.2f}ms")

        # Slowest endpoints
        print("\n🐌 SLOWEST ENDPOINTS (Top 10)")
        print("-" * 80)
        slowest = sorted(self.results, key=lambda r: r.duration_ms, reverse=True)[:10]
        for i, result in enumerate(slowest, 1):
            params_str = json.dumps(result.params)[:50] if result.params else ""
            print(f"{i}. {result.method} {result.endpoint}")
            print(f"   Duration: {result.duration_ms:.2f}ms | Size: {self.format_bytes(result.response_size_bytes)}")
            if params_str:
                print(f"   Params: {params_str}")

        # Largest responses
        print("\n📦 LARGEST RESPONSES (Top 10)")
        print("-" * 80)
        largest = sorted(self.results, key=lambda r: r.response_size_bytes, reverse=True)[:10]
        for i, result in enumerate(largest, 1):
            params_str = json.dumps(result.params)[:50] if result.params else ""
            print(f"{i}. {result.method} {result.endpoint}")
            print(f"   Size: {self.format_bytes(result.response_size_bytes)} | Duration: {result.duration_ms:.2f}ms")
            if params_str:
                print(f"   Params: {params_str}")

        # Failures (excluding expected 429s)
        actual_failures = [r for r in self.results if not r.success and r.status_code != 429]
        if actual_failures:
            print("\n❌ FAILURES")
            print("-" * 80)
            for result in actual_failures:
                print(f"{result.method} {result.endpoint}")
                print(f"   Status: {result.status_code} | Error: {result.error}")
                print(f"   Params: {json.dumps(result.params)}")

        # Show 429s separately as informational
        rate_limits = [r for r in self.results if r.status_code == 429]
        if rate_limits:
            print("\nℹ️  RATE LIMITED (Expected)")
            print("-" * 80)
            for result in rate_limits:
                print(f"{result.method} {result.endpoint}")
                print(f"   Params: {json.dumps(result.params)}")

        # Save detailed results to JSON
        self.save_results_to_file()

    def format_bytes(self, bytes_val: float) -> str:
        """Format bytes to human-readable string."""
        for unit in ["B", "KB", "MB", "GB"]:
            if bytes_val < 1024.0:
                return f"{bytes_val:.2f} {unit}"
            bytes_val /= 1024.0
        return f"{bytes_val:.2f} TB"

    def save_results_to_file(self):
        """Save detailed results to JSON file."""
        if self.output_filename:
            filename = self.output_filename
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"benchmark_results_{timestamp}.json"

        results_data = {
            "timestamp": datetime.now().isoformat(),
            "base_url": self.base_url,
            "user_id": str(self.user_id),
            "total_calls": len(self.results),
            "results": [
                {
                    "endpoint": r.endpoint,
                    "method": r.method,
                    "params": r.params,
                    "duration_ms": r.duration_ms,
                    "response_size_bytes": r.response_size_bytes,
                    "status_code": r.status_code,
                    "success": r.success,
                    "error": r.error,
                }
                for r in self.results
            ],
        }

        with open(filename, "w") as f:
            json.dump(results_data, f, indent=2)

        print(f"\n💾 Detailed results saved to: {filename}")


async def main():
    """Main execution."""
    if len(sys.argv) < 4:
        print("❌ Usage: python benchmark_api.py <base_url> <email> <password> [test_user_id] [output_filename]")
        print("   Example: python benchmark_api.py http://localhost:8000 test@example.com password123")
        print(
            "   Or with specific user: python benchmark_api.py http://localhost:8000 test@example.com password123 123e4567-e89b-12d3-a456-426614174000"
        )
        print(
            "   Or with custom output: python benchmark_api.py http://localhost:8000 test@example.com password123 123e4567-e89b-12d3-a456-426614174000 my_benchmark.json"
        )
        sys.exit(1)

    base_url = sys.argv[1]
    email = sys.argv[2]
    password = sys.argv[3]

    try:
        # Authenticate and get token
        auth_token, authenticated_user_id = await APIBenchmark.authenticate(base_url, email, password)

        # Use provided user_id if given, otherwise use authenticated user
        user_id = authenticated_user_id
        output_filename = None

        if len(sys.argv) >= 5:
            try:
                user_id = UUID(sys.argv[4])
                print(f"ℹ️  Using specified user ID: {user_id}")
            except ValueError:
                print(f"❌ Invalid UUID: {sys.argv[4]}")
                sys.exit(1)
        else:
            print(f"ℹ️  Using authenticated user ID: {user_id}")

        # Check for output filename parameter
        if len(sys.argv) >= 6:
            output_filename = sys.argv[5]
            print(f"ℹ️  Output will be saved to: {output_filename}")

        benchmark = APIBenchmark(base_url, auth_token, user_id, output_filename)
        await benchmark.run_all_benchmarks()

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
