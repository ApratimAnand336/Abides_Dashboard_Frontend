import sys
import os
import json
import pickle
import numpy as np
import pandas as pd

def clean_val(v):
    if isinstance(v, (np.integer, int)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        return float(v) if np.isfinite(v) else None
    if isinstance(v, np.ndarray):
        return v.tolist()
    if isinstance(v, pd.DataFrame):
        return v.replace({np.nan: None}).to_dict(orient='records')
    if isinstance(v, dict):
        return {str(k): clean_val(val) for k, val in v.items()}
    if isinstance(v, list):
        return [clean_val(item) for item in v]
    return v

def main():
    if len(sys.argv) < 3:
        print("Usage: python pickle_to_json.py <input.pkl> <output.json>")
        sys.exit(1)
    
    in_pkl = sys.argv[1]
    out_json = sys.argv[2]

    if not os.path.exists(in_pkl):
        print(f"Error: file not found {in_pkl}")
        sys.exit(1)

    with open(in_pkl, 'rb') as f:
        data = pickle.load(f)

    cleaned = clean_val(data)
    with open(out_json, 'w') as f:
        json.dump(cleaned, f)

    print(f"Converted {in_pkl} -> {out_json} successfully ({os.path.getsize(out_json)} bytes)")

if __name__ == '__main__':
    main()
