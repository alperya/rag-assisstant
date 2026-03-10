"""S3 sync module for Lambda deployment.
Syncs ChromaDB data between S3 and local filesystem (/tmp)."""

import os
import tarfile
import logging

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class S3Sync:
    """Handles syncing ChromaDB persistent data to/from S3."""

    def __init__(self, bucket: str, key: str = "chroma_data.tar.gz"):
        self.s3 = boto3.client("s3")
        self.bucket = bucket
        self.key = key

    def download(self, local_dir: str) -> bool:
        """Download and extract ChromaDB data from S3 to local directory."""
        tar_path = "/tmp/_chroma_backup.tar.gz"
        os.makedirs(local_dir, exist_ok=True)

        try:
            self.s3.download_file(self.bucket, self.key, tar_path)
            with tarfile.open(tar_path, "r:gz") as tar:
                tar.extractall(local_dir)
            logger.info("ChromaDB data restored from s3://%s/%s", self.bucket, self.key)
            return True
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "")
            if code in ("404", "NoSuchKey"):
                logger.info("No existing ChromaDB backup in S3 — starting fresh.")
            else:
                logger.error("S3 download error: %s", e)
            return False
        except Exception as e:
            logger.error("Error restoring ChromaDB from S3: %s", e)
            return False
        finally:
            if os.path.exists(tar_path):
                os.remove(tar_path)

    def upload(self, local_dir: str) -> bool:
        """Compress and upload ChromaDB data from local directory to S3."""
        tar_path = "/tmp/_chroma_backup.tar.gz"

        try:
            with tarfile.open(tar_path, "w:gz") as tar:
                for item in os.listdir(local_dir):
                    tar.add(os.path.join(local_dir, item), arcname=item)

            self.s3.upload_file(tar_path, self.bucket, self.key)
            logger.info("ChromaDB data synced to s3://%s/%s", self.bucket, self.key)
            return True
        except Exception as e:
            logger.error("Error syncing ChromaDB to S3: %s", e)
            return False
        finally:
            if os.path.exists(tar_path):
                os.remove(tar_path)
