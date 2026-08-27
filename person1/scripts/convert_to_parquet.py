#!/usr/bin/env python3
"""
SIH26102 — Parquet Dataset Converter (Phase 4)
Converts all 7 processed CSV datasets in data/processed/ to Snappy-compressed Apache Parquet format.

Usage:
    python scripts/convert_to_parquet.py
"""
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

TARGET_DATASETS = [
    "projects",
    "payments",
    "implementing_agencies",
    "mps",
    "constituencies",
    "districts",
    "states"
]

def convert_to_parquet():
    processed_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "processed")
    if not os.path.exists(processed_dir):
        print(f"[Error] Directory not found: {processed_dir}")
        print("Please run 'npm run export' first.")
        sys.exit(1)

    try:
        import pandas as pd
        import pyarrow.parquet as pq
        import pyarrow as pa
    except ImportError:
        print("[Notice] pandas or pyarrow not installed in current Python environment.")
        print("Install with: pip install pandas pyarrow")
        print("Exported CSV and JSON datasets are available directly under data/processed/.")
        sys.exit(0)

    print("=========================================================")
    print("  SIH26102 -- MPLADS Parquet Dataset Converter")
    print("  Phase 4: 7 Canonical Datasets to Apache Parquet")
    print("=========================================================\n")

    converted_count = 0
    for dataset in TARGET_DATASETS:
        csv_file = os.path.join(processed_dir, f"{dataset}.csv")
        parquet_file = os.path.join(processed_dir, f"{dataset}.parquet")
        
        if not os.path.exists(csv_file):
            print(f"  [!] Skipping {dataset}.csv (file not found)")
            continue

        try:
            df = pd.read_csv(csv_file, low_memory=False)
            table = pa.Table.from_pandas(df)
            pq.write_table(table, parquet_file, compression='snappy')
            size_kb = os.path.getsize(parquet_file) / 1024
            print(f"  [+] Converted {dataset}.csv -> {dataset}.parquet ({size_kb:.1f} KB, {len(df)} records)")
            converted_count += 1
        except Exception as e:
            print(f"  [-] Failed to convert {dataset}.csv: {e}")

    print(f"\nSuccessfully converted {converted_count}/{len(TARGET_DATASETS)} datasets to Parquet.")

if __name__ == "__main__":
    convert_to_parquet()
