import os
from typing import Optional, Dict, Any

def is_dicom_file(filepath: str) -> bool:
    """Check if file is a valid DICOM file by checking magic bytes."""
    try:
        with open(filepath, 'rb') as f:
            f.seek(128)
            magic = f.read(4)
            return magic == b'DICM'
    except:
        return False

def extract_dicom_metadata(filepath: str) -> Optional[Dict[str, Any]]:
    """Extract metadata from DICOM file using pydicom."""
    try:
        import pydicom
        ds = pydicom.dcmread(filepath, stop_before_pixels=True)
        return {
            "seriesInstanceUID": str(getattr(ds, 'SeriesInstanceUID', '')),
            "instanceNumber": int(getattr(ds, 'InstanceNumber', 0)) if hasattr(ds, 'InstanceNumber') else None,
            "modality": str(getattr(ds, 'Modality', '')),
            "patientId": str(getattr(ds, 'PatientID', '')),
            "studyDate": str(getattr(ds, 'StudyDate', '')),
            "seriesDescription": str(getattr(ds, 'SeriesDescription', ''))
        }
    except Exception as e:
        print(f"Error extracting DICOM metadata: {e}")
        return None
