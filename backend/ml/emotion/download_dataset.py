import os
import sys
import subprocess
import argparse

def download_fer2013(target_dir: str = "data"):
    """Downloads the FER2013 dataset using the official Kaggle CLI.
    Requires KAGGLE_USERNAME and KAGGLE_KEY environment variables or ~/.kaggle/kaggle.json.
    """
    os.makedirs(target_dir, exist_ok=True)
    dataset_name = "msambare/fer2013"
    
    print(f"[*] Downloading FER2013 dataset ({dataset_name}) to {target_dir}...")
    try:
        cmd = ["kaggle", "datasets", "download", "-d", dataset_name, "-p", target_dir, "--unzip"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print("[+] FER2013 Dataset downloaded and extracted successfully:")
        print(result.stdout)
    except FileNotFoundError:
        print("[!] Kaggle CLI tool not found. Please install via: pip install kaggle")
        print("[!] Set KAGGLE_USERNAME and KAGGLE_KEY environment variables before running.")
    except subprocess.CalledProcessError as e:
        print(f"[!] Error downloading dataset: {e.stderr}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download FER2013 Facial Expression Dataset")
    parser.add_argument("--dir", default="data", help="Target data directory")
    args = parser.parse_args()
    download_fer2013(args.dir)
