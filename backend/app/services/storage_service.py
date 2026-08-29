import os
import uuid
from typing import Optional, Dict, Any
from fastapi import HTTPException, status

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
RECORDINGS_DIR = os.path.abspath(os.path.join(BACKEND_DIR, "static", "uploads", "recordings"))
os.makedirs(RECORDINGS_DIR, exist_ok=True)

MAX_RECORDING_SIZE = 100 * 1024 * 1024 # 100 MB
ALLOWED_MIME_TYPES = [
    "video/webm",
    "video/mp4",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
    "audio/wav",
    "video/x-matroska",
    "application/octet-stream"
]

FORBIDDEN_EXTENSIONS = {".exe", ".sh", ".php", ".js", ".html", ".py", ".bat", ".cmd", ".pl", ".vbs"}

class StorageService:
    def __init__(self, base_dir: str = RECORDINGS_DIR):
        self.base_dir = os.path.abspath(base_dir)
        self.alt_base_dirs = [
            self.base_dir,
            os.path.abspath(os.path.join(PROJECT_ROOT, "static", "uploads", "recordings")),
            os.path.abspath(os.path.join(PROJECT_ROOT, "uploads", "recordings")),
            os.path.abspath(os.path.join(BACKEND_DIR, "uploads", "recordings"))
        ]
        for d in self.alt_base_dirs:
            os.makedirs(d, exist_ok=True)

    def _sanitize_path(self, target_path: str) -> str:
        abs_path = os.path.abspath(target_path)
        is_safe = False
        for root_dir in [self.base_dir, PROJECT_ROOT, BACKEND_DIR]:
            try:
                common = os.path.commonpath([abs_path, root_dir])
                if common == root_dir:
                    is_safe = True
                    break
            except Exception:
                pass
        if not is_safe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Invalid storage path or directory traversal detected."
            )
        return abs_path

    def validate_recording_file(self, filename: str, mime_type: str, file_size: int):
        ext = os.path.splitext(filename.lower())[1]
        if ext in FORBIDDEN_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Security error: Executable or script format '{ext}' is forbidden."
            )

        if file_size <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid upload: Recording file is empty."
            )

        if file_size > MAX_RECORDING_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Recording size ({file_size} bytes) exceeds maximum limit of {MAX_RECORDING_SIZE} bytes (100 MB)."
            )

        # Normalize mime type (e.g. video/webm;codecs=vp8 -> video/webm)
        base_mime = mime_type.split(";")[0].strip().lower()
        if base_mime not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid MIME type '{mime_type}'. Supported media types: video/webm, video/mp4, audio/webm."
            )

    def save_recording(
        self,
        candidate_id: str,
        session_id: str,
        file_content: bytes,
        original_filename: str,
        mime_type: str
    ) -> Dict[str, Any]:
        file_size = len(file_content)
        self.validate_recording_file(original_filename, mime_type, file_size)

        # Safe server-generated extension
        ext = os.path.splitext(original_filename.lower())[1]
        if ext not in [".webm", ".mp4", ".ogg", ".wav", ".mkv"]:
            ext = ".webm" if "mp4" not in mime_type else ".mp4"

        recording_id = str(uuid.uuid4())
        safe_filename = f"rec_{recording_id}{ext}"

        # Controlled directory hierarchy: static/uploads/recordings/{candidate_id}/{session_id}/
        session_dir = os.path.join(self.base_dir, candidate_id, session_id)
        self._sanitize_path(session_dir)
        os.makedirs(session_dir, exist_ok=True)

        full_disk_path = os.path.join(session_dir, safe_filename)
        self._sanitize_path(full_disk_path)

        with open(full_disk_path, "wb") as f:
            f.write(file_content)

        relative_web_url = f"/uploads/recordings/{candidate_id}/{session_id}/{safe_filename}"

        return {
            "recording_id": recording_id,
            "full_disk_path": full_disk_path,
            "file_path": relative_web_url,
            "storage_key": f"{candidate_id}/{session_id}/{safe_filename}",
            "file_size": file_size,
            "mime_type": mime_type,
            "extension": ext
        }

    def delete_recording(self, file_path_or_key: str) -> bool:
        if not file_path_or_key:
            return False

        # Convert web URL path back to local disk path if needed
        clean_path = file_path_or_key.replace("/uploads/recordings/", "")
        disk_path = os.path.join(self.base_dir, clean_path)

        try:
            safe_disk_path = self._sanitize_path(disk_path)
            if os.path.exists(safe_disk_path):
                os.remove(safe_disk_path)
                return True
        except Exception:
            pass
        return False

    def get_recording_path(self, file_path_or_key: str) -> Optional[str]:
        if not file_path_or_key:
            return None
        clean_path = file_path_or_key.replace("/uploads/recordings/", "").replace("\\uploads\\recordings\\", "").lstrip("/\\")
        
        # Check all alternate storage directories
        for base in self.alt_base_dirs:
            candidate_path = os.path.normpath(os.path.join(base, clean_path))
            try:
                safe_path = self._sanitize_path(candidate_path)
                if os.path.exists(safe_path) and os.path.getsize(safe_path) > 0:
                    return safe_path
            except Exception:
                pass

        # If direct path not found, search by session_id or filename in all storage directories
        base_name = os.path.basename(clean_path)
        for base in self.alt_base_dirs:
            if os.path.exists(base):
                for root, _, files in os.walk(base):
                    if base_name in files:
                        p = os.path.join(root, base_name)
                        if os.path.exists(p) and os.path.getsize(p) > 0:
                            return p
        return None

    def exists(self, file_path_or_key: str) -> bool:
        return self.get_recording_path(file_path_or_key) is not None

storage_service = StorageService()
