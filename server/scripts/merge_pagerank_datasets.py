#!/usr/bin/env python3
"""
Script to merge PageRank datasets into a single optimized file.
Run this once to create the merged dataset for production use.

Usage:
    python scripts/merge_pagerank_datasets.py --input-dir rss_dataset/page_rank --output app/data/merged_pagerank.json
"""

import json
import csv
import argparse
import os
from typing import Dict
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def load_tranco(filepath: str) -> Dict[str, int]:
    """Load Tranco ranking data."""
    domain_scores = {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) >= 2:
                    rank, domain = row[0], row[1]
                    try:
                        rank_int = int(rank)
                        domain_clean = domain.lower().replace('www.', '')
                        # Convert rank to score (1-100, higher rank = lower score)
                        score = max(1, 100 - (rank_int - 1) // 10000)
                        domain_scores[domain_clean] = score
                    except ValueError:
                        continue
        logger.info(f"Loaded {len(domain_scores)} domains from Tranco")
    except Exception as e:
        logger.error(f"Error loading Tranco data: {e}")
    return domain_scores


def load_majestic(filepath: str) -> Dict[str, int]:
    """Load Majestic Million ranking data."""
    domain_scores = {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    rank = int(row['GlobalRank'])
                    domain = row['Domain'].lower().replace('www.', '')
                    ref_subnets = int(row['RefSubNets'])
                    ref_ips = int(row['RefIPs'])
                    
                    # Majestic scoring: rank + reference bonus
                    rank_score = max(1, 100 - (rank - 1) // 10000)
                    ref_bonus = min(20, (ref_subnets + ref_ips) // 50000)
                    score = min(100, rank_score + ref_bonus)
                    
                    domain_scores[domain] = score
                except (ValueError, KeyError):
                    continue
        logger.info(f"Loaded {len(domain_scores)} domains from Majestic")
    except Exception as e:
        logger.error(f"Error loading Majestic data: {e}")
    return domain_scores


def load_umbrella(filepath: str) -> Dict[str, int]:
    """Load Cisco Umbrella ranking data."""
    domain_scores = {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) >= 2:
                    rank, domain = row[0], row[1]
                    try:
                        rank_int = int(rank)
                        domain_clean = domain.lower().replace('www.', '')
                        score = max(1, 100 - (rank_int - 1) // 10000)
                        domain_scores[domain_clean] = score
                    except ValueError:
                        continue
        logger.info(f"Loaded {len(domain_scores)} domains from Umbrella")
    except Exception as e:
        logger.error(f"Error loading Umbrella data: {e}")
    return domain_scores


def merge_datasets(tranco: Dict[str, int], majestic: Dict[str, int], umbrella: Dict[str, int]) -> Dict[str, float]:
    """Merge all datasets with weighted averaging."""
    merged = {}
    all_domains = set(tranco.keys()) | set(majestic.keys()) | set(umbrella.keys())
    
    for domain in all_domains:
        scores = []
        
        # Collect scores from available datasets
        if domain in tranco:
            scores.append(tranco[domain])
        if domain in majestic:
            scores.append(majestic[domain])
        if domain in umbrella:
            scores.append(umbrella[domain])
        
        # Calculate weighted average (prefer domains with multiple sources)
        if len(scores) > 1:
            # Bonus for domains appearing in multiple datasets
            avg_score = sum(scores) / len(scores)
            merged[domain] = round(avg_score, 1)
        else:
            # Single dataset domains get slightly lower scores
            merged[domain] = round(scores[0] * 0.9, 1)
    
    return merged


def main():
    parser = argparse.ArgumentParser(description="Merge PageRank datasets")
    parser.add_argument('--input-dir', required=True, help='Input directory with CSV files')
    parser.add_argument('--output', required=True, help='Output JSON file path')
    
    args = parser.parse_args()
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    
    # Load individual datasets
    tranco_file = os.path.join(args.input_dir, 'tranco.csv')
    majestic_file = os.path.join(args.input_dir, 'majestic_million.csv')
    umbrella_file = os.path.join(args.input_dir, 'umbrella.csv')
    
    tranco_data = load_tranco(tranco_file) if os.path.exists(tranco_file) else {}
    majestic_data = load_majestic(majestic_file) if os.path.exists(majestic_file) else {}
    umbrella_data = load_umbrella(umbrella_file) if os.path.exists(umbrella_file) else {}
    
    # Merge datasets
    logger.info("Merging datasets...")
    merged_data = merge_datasets(tranco_data, majestic_data, umbrella_data)
    
    # Save merged dataset
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(merged_data, f, separators=(',', ':'))  # Compact format
    
    logger.info(f"Merged dataset saved to {args.output}")
    logger.info(f"Total domains: {len(merged_data)}")
    logger.info(f"File size: {os.path.getsize(args.output) / 1024 / 1024:.1f} MB")
    
    # Show some sample entries
    sample_domains = list(merged_data.items())[:5]
    logger.info("Sample entries:")
    for domain, score in sample_domains:
        logger.info(f"  {domain}: {score}")


if __name__ == '__main__':
    main()