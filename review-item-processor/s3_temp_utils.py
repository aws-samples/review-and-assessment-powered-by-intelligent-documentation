import json
import boto3
import uuid
from datetime import datetime, timedelta
from typing import Any, Union

class S3TempStorage:
    def __init__(self, bucket_name: str, key_prefix: str = "temp/", ttl_hours: int = 24):
        self.bucket_name = bucket_name
        self.key_prefix = key_prefix
        self.ttl_hours = ttl_hours
        self.s3_client = boto3.client("s3")
    
    def store(self, payload: Any) -> dict:
        """
        ペイロード全体をS3に保存し、参照情報を返す
        """
        temp_key = f"{self.key_prefix}{uuid.uuid4()}.json"
        expires_at = datetime.utcnow() + timedelta(hours=self.ttl_hours)
        
        payload_json = json.dumps(payload, ensure_ascii=False)
        
        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=temp_key,
            Body=payload_json.encode("utf-8"),
            ContentType="application/json",
            Metadata={
                "expires_at": expires_at.isoformat(),
                "size": str(len(payload_json.encode("utf-8"))),
            },
        )
        
        print(
            f"[S3Temp] Stored data to: {temp_key} ({len(payload_json.encode('utf-8'))} bytes)"
        )
        
        return {
            "__s3_temp_ref__": True,
            "bucket": self.bucket_name,
            "key": temp_key,
            "expires_at": expires_at.isoformat(),
        }
    
    def resolve(self, input_data: Union[Any, dict]) -> Any:
        """
        S3参照から実データを復元
        """
        if self._is_s3_temp_ref(input_data):
            print(f"[S3Temp] Resolving data from: {input_data['key']}")
            
            # S3から実データを取得
            response = self.s3_client.get_object(
                Bucket=input_data["bucket"], Key=input_data["key"]
            )
            
            body = response["Body"].read().decode("utf-8")
            resolved_data = json.loads(body)
            
            print(
                f"[S3Temp] Resolved data from: {input_data['key']} ({len(body)} bytes)"
            )
            
            # 取得後にクリーンアップ
            self._cleanup(input_data)
            
            return resolved_data
        
        return input_data
    
    def _is_s3_temp_ref(self, data: Any) -> bool:
        """S3参照かどうかを判定"""
        return (
            isinstance(data, dict)
            and data.get("__s3_temp_ref__") is True
            and "bucket" in data
            and "key" in data
        )
    
    def _cleanup(self, ref: dict) -> None:
        """S3の一時データを削除"""
        try:
            self.s3_client.delete_object(Bucket=ref["bucket"], Key=ref["key"])
            print(f"[S3Temp] Cleaned up: {ref['key']}")
        except Exception as e:
            print(f"[S3Temp] Failed to cleanup {ref['key']}: {str(e)}")