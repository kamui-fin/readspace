"""
Compare two benchmark results to identify performance changes.

Usage: python compare_benchmarks.py <baseline.json> <current.json>
Example: python compare_benchmarks.py benchmark_results_20250101_120000.json benchmark_results_20250101_130000.json
"""

import json
import sys
from pathlib import Path
from typing import Any


def load_benchmark(filepath: str) -> dict[str, Any]:
    """Load benchmark results from JSON file."""
    with open(filepath) as f:
        return json.load(f)


def format_duration(ms: float) -> str:
    """Format duration in milliseconds."""
    if ms < 1000:
        return f"{ms:.2f}ms"
    return f"{ms/1000:.2f}s"


def format_size(bytes_val: float) -> str:
    """Format bytes to human-readable string."""
    for unit in ["B", "KB", "MB", "GB"]:
        if bytes_val < 1024.0:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.2f} TB"


def calculate_change_percent(baseline: float, current: float) -> float:
    """Calculate percentage change."""
    if baseline == 0:
        return 0.0
    return ((current - baseline) / baseline) * 100


def get_endpoint_key(result: dict[str, Any]) -> str:
    """Get unique key for endpoint."""
    endpoint = result["endpoint"]
    method = result["method"]
    # Include key params for uniqueness
    params = result.get("params", {})
    param_str = ""
    if params:
        # Only include significant params
        key_params = []
        for key in ["page", "size", "sort_by", "sort_order", "limit"]:
            if key in params:
                key_params.append(f"{key}={params[key]}")
        if key_params:
            param_str = f"?{','.join(key_params)}"
    return f"{method} {endpoint}{param_str}"


def compare_benchmarks(baseline_file: str, current_file: str):
    """Compare two benchmark results."""
    print("=" * 100)
    print("📊 BENCHMARK COMPARISON")
    print("=" * 100)

    # Load results
    baseline = load_benchmark(baseline_file)
    current = load_benchmark(current_file)

    print(f"\nBaseline: {baseline_file}")
    print(f"  Time: {baseline['timestamp']}")
    print(f"  Total Calls: {baseline['total_calls']}")

    print(f"\nCurrent: {current_file}")
    print(f"  Time: {current['timestamp']}")
    print(f"  Total Calls: {current['total_calls']}")

    # Group results by endpoint
    baseline_by_endpoint: dict[str, list[dict]] = {}
    for result in baseline["results"]:
        key = get_endpoint_key(result)
        if key not in baseline_by_endpoint:
            baseline_by_endpoint[key] = []
        baseline_by_endpoint[key].append(result)

    current_by_endpoint: dict[str, list[dict]] = {}
    for result in current["results"]:
        key = get_endpoint_key(result)
        if key not in current_by_endpoint:
            current_by_endpoint[key] = []
        current_by_endpoint[key].append(result)

    # Calculate statistics for each endpoint
    comparisons = []
    for endpoint_key in sorted(set(baseline_by_endpoint.keys()) | set(current_by_endpoint.keys())):
        baseline_results = baseline_by_endpoint.get(endpoint_key, [])
        current_results = current_by_endpoint.get(endpoint_key, [])

        if not baseline_results or not current_results:
            continue

        # Calculate averages
        baseline_avg = sum(r["duration_ms"] for r in baseline_results) / len(baseline_results)
        current_avg = sum(r["duration_ms"] for r in current_results) / len(current_results)

        baseline_size = sum(r["response_size_bytes"] for r in baseline_results) / len(baseline_results)
        current_size = sum(r["response_size_bytes"] for r in current_results) / len(current_results)

        # Calculate changes
        duration_change = calculate_change_percent(baseline_avg, current_avg)
        size_change = calculate_change_percent(baseline_size, current_size)

        comparisons.append(
            {
                "endpoint": endpoint_key,
                "baseline_avg": baseline_avg,
                "current_avg": current_avg,
                "duration_change": duration_change,
                "baseline_size": baseline_size,
                "current_size": current_size,
                "size_change": size_change,
            }
        )

    # Print summary
    print("\n" + "=" * 100)
    print("📈 PERFORMANCE CHANGES")
    print("=" * 100)

    # Overall statistics
    total_baseline_duration = sum(c["baseline_avg"] for c in comparisons)
    total_current_duration = sum(c["current_avg"] for c in comparisons)
    overall_change = calculate_change_percent(total_baseline_duration, total_current_duration)

    print(f"\nOverall Performance Change: {overall_change:+.2f}%")
    if overall_change < 0:
        print(f"  ✅ Faster by {abs(overall_change):.2f}%")
    elif overall_change > 0:
        print(f"  ⚠️  Slower by {overall_change:.2f}%")
    else:
        print("  ➡️  No change")

    # Biggest improvements
    print("\n🚀 BIGGEST IMPROVEMENTS (Top 10)")
    print("-" * 100)
    improvements = sorted([c for c in comparisons if c["duration_change"] < 0], key=lambda x: x["duration_change"])[:10]
    if improvements:
        for i, comp in enumerate(improvements, 1):
            print(f"{i}. {comp['endpoint']}")
            print(
                f"   {format_duration(comp['baseline_avg'])} → {format_duration(comp['current_avg'])} "
                f"({comp['duration_change']:.2f}%)"
            )
    else:
        print("No improvements found")

    # Biggest regressions
    print("\n⚠️  BIGGEST REGRESSIONS (Top 10)")
    print("-" * 100)
    regressions = sorted([c for c in comparisons if c["duration_change"] > 0], key=lambda x: x["duration_change"], reverse=True)[
        :10
    ]
    if regressions:
        for i, comp in enumerate(regressions, 1):
            print(f"{i}. {comp['endpoint']}")
            print(
                f"   {format_duration(comp['baseline_avg'])} → {format_duration(comp['current_avg'])} "
                f"({comp['duration_change']:+.2f}%)"
            )
    else:
        print("No regressions found")

    # Detailed comparison table
    print("\n" + "=" * 100)
    print("📋 DETAILED COMPARISON")
    print("=" * 100)
    print(
        f"\n{'Endpoint':<60} {'Baseline':<15} {'Current':<15} {'Change':<15} {'Status':<10}"
    )
    print("-" * 115)

    for comp in sorted(comparisons, key=lambda x: abs(x["duration_change"]), reverse=True):
        endpoint = comp["endpoint"][:58]
        baseline_str = format_duration(comp["baseline_avg"])
        current_str = format_duration(comp["current_avg"])
        change_str = f"{comp['duration_change']:+.2f}%"

        # Status indicator
        if comp["duration_change"] < -10:
            status = "✅ Better"
        elif comp["duration_change"] > 10:
            status = "⚠️  Slower"
        else:
            status = "➡️  Similar"

        print(f"{endpoint:<60} {baseline_str:<15} {current_str:<15} {change_str:<15} {status:<10}")

    # Data transfer comparison
    print("\n" + "=" * 100)
    print("📦 DATA TRANSFER CHANGES")
    print("=" * 100)

    total_baseline_size = sum(c["baseline_size"] for c in comparisons)
    total_current_size = sum(c["current_size"] for c in comparisons)
    size_change = calculate_change_percent(total_baseline_size, total_current_size)

    print(f"\nTotal Data Transfer Change: {size_change:+.2f}%")
    print(f"  Baseline: {format_size(total_baseline_size)}")
    print(f"  Current: {format_size(total_current_size)}")

    # Significant size changes
    significant_size_changes = [c for c in comparisons if abs(c["size_change"]) > 10]
    if significant_size_changes:
        print("\nSignificant Size Changes (>10%):")
        print("-" * 100)
        for comp in sorted(significant_size_changes, key=lambda x: abs(x["size_change"]), reverse=True)[:10]:
            print(f"{comp['endpoint']}")
            print(
                f"  {format_size(comp['baseline_size'])} → {format_size(comp['current_size'])} "
                f"({comp['size_change']:+.2f}%)"
            )

    # New endpoints
    new_endpoints = set(current_by_endpoint.keys()) - set(baseline_by_endpoint.keys())
    if new_endpoints:
        print("\n" + "=" * 100)
        print("🆕 NEW ENDPOINTS")
        print("=" * 100)
        for endpoint in sorted(new_endpoints):
            results = current_by_endpoint[endpoint]
            avg_duration = sum(r["duration_ms"] for r in results) / len(results)
            print(f"{endpoint}: {format_duration(avg_duration)}")

    # Removed endpoints
    removed_endpoints = set(baseline_by_endpoint.keys()) - set(current_by_endpoint.keys())
    if removed_endpoints:
        print("\n" + "=" * 100)
        print("🗑️  REMOVED ENDPOINTS")
        print("=" * 100)
        for endpoint in sorted(removed_endpoints):
            print(f"{endpoint}")

    # Summary recommendations
    print("\n" + "=" * 100)
    print("💡 RECOMMENDATIONS")
    print("=" * 100)

    if overall_change > 5:
        print("⚠️  Overall performance has degraded by more than 5%")
        print("   - Review the biggest regressions above")
        print("   - Check for missing indexes or inefficient queries")
        print("   - Consider profiling slow endpoints with EXPLAIN ANALYZE")
    elif overall_change < -5:
        print("✅ Overall performance has improved by more than 5%")
        print("   - Great work! Document what changes led to this improvement")
    else:
        print("➡️  Performance is stable (within 5% variance)")

    if regressions:
        critical_regressions = [r for r in regressions if r["duration_change"] > 50]
        if critical_regressions:
            print(f"\n⚠️  {len(critical_regressions)} endpoint(s) are >50% slower - investigate immediately!")

    if improvements:
        significant_improvements = [i for i in improvements if i["duration_change"] < -50]
        if significant_improvements:
            print(f"\n✅ {len(significant_improvements)} endpoint(s) are >50% faster - excellent!")


def main():
    """Main execution."""
    if len(sys.argv) < 3:
        print("❌ Usage: python compare_benchmarks.py <baseline.json> <current.json>")
        print("   Example: python compare_benchmarks.py benchmark_results_20250101_120000.json benchmark_results_20250101_130000.json")
        sys.exit(1)

    baseline_file = sys.argv[1]
    current_file = sys.argv[2]

    # Check files exist
    if not Path(baseline_file).exists():
        print(f"❌ Baseline file not found: {baseline_file}")
        sys.exit(1)

    if not Path(current_file).exists():
        print(f"❌ Current file not found: {current_file}")
        sys.exit(1)

    compare_benchmarks(baseline_file, current_file)


if __name__ == "__main__":
    main()
